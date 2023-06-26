'use strict';

var CryptoJS = require('crypto-js');
var dotenv = require('dotenv');
var Web3 = require('web3');
var EventEmitter = require('events');
var socket_ioClient = require('socket.io-client');

class Listener extends EventEmitter {

    constructor() {

        super();
    }

    connect(network, parentAddress, providerURLs) {

        const options = { timeout: 1000, clientConfig: { keepalive: true, keepaliveInterval: 60000 } };
        const PARENT_ABI = [{ "inputs": [{ "internalType": "string", "name": "_name", "type": "string" }], "name": "GetContractAddress", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }];
        const PROCESSOR_ABI = [{ "anonymous": false, "inputs": [{ "indexed": true, "internalType": "bytes32", "name": "verification", "type": "bytes32" }, { "indexed": false, "internalType": "uint32", "name": "timestamp", "type": "uint32" }], "name": "Processed", "type": "event" }];

        class Providers {

            this = [];
        }

        const uRLCount = providerURLs.length;

        const reconnectAftenMilliseconds = 10000;
        let wasConnected = Array(uRLCount).fill(false);

        let connectedProviders = 0;
        let connectedListeners = 0;

        let processorAddress = "0x0000000000000000000000000000000000000000";

        let nextTxIndex = 0;
        let txLoop = new Array(10);
        const txLoopLength = txLoop.length;

        const connect = (providerURL, providerIndex) => {

            Providers[providerIndex] = new Web3.providers.WebsocketProvider(providerURL, options);

            Providers[providerIndex].on("error", () => {
                reconnect(providerURL, providerIndex);
            }).on("close", () => {
                reconnect(providerURL, providerIndex);
            }).on("connect", () => {

                wasConnected[providerIndex] = true;

                connectedProviders++;
                this.emit('connUpdate', network, connectedProviders, connectedListeners);

                let web3Instance = new Web3(Providers[providerIndex]);

                if (processorAddress == "0x0000000000000000000000000000000000000000") {

                    let parentContract = new web3Instance.eth.Contract(PARENT_ABI, parentAddress);

                    parentContract.methods.GetContractAddress(".Payment.Processor").call((error, address) => {

                        if (!error) {

                            if (address != "0x0000000000000000000000000000000000000000") {

                                processorAddress = address;
                                listen(web3Instance);
                            }
                        }
                    });
                }
                else
                    listen(web3Instance);
            });
        };

        const reconnect = (providerURL, providerIndex) => {

            if (wasConnected[providerIndex]) {

                wasConnected[providerIndex] = false;
                this.emit('connUpdate', network, connectedProviders, connectedListeners);

                connectedProviders--;
                connectedListeners--;

                let pollingReconnection = setInterval(() => {

                    if (!wasConnected[providerIndex])
                        connect(providerURL, providerIndex);
                    else
                        clearInterval(pollingReconnection);
                }, reconnectAftenMilliseconds);
            }
        };

        const listen = (web3Instance) => {

            let processorContract = new web3Instance.eth.Contract(PROCESSOR_ABI, processorAddress);

            processorContract.events.Processed((error, data) => {

                if (!error) {

                    let transactionHash = data.transactionHash;
                    let verification = data.returnValues.verification;
                    let timestamp = data.returnValues.timestamp;

                    let tnow = Math.floor(Date.now() / 1000);
                    let expire = Number(timestamp) + 905;

                    if (expire >= tnow) {

                        let checkIndex;
                        let isNew = true;

                        for (let i = 0; i < txLoopLength; i++) {

                            checkIndex = nextTxIndex - 1 - i;

                            if (checkIndex < 0)
                                checkIndex = txLoopLength - 1 - i;

                            if (txLoop[checkIndex] === transactionHash) {

                                isNew = false;
                                i = txLoopLength;
                            }
                        }

                        if (isNew) {

                            txLoop[nextTxIndex] = transactionHash;

                            nextTxIndex++;

                            if (nextTxIndex >= txLoopLength)
                                nextTxIndex = 0;

                            this.emit('newTx', network, transactionHash, verification, timestamp);
                        }
                    }
                }
                else
                    console.log(error);
            });

            connectedListeners++;
            this.emit('connUpdate', network, connectedProviders, connectedListeners);

        };

        for (let j = 0; j < providerURLs.length; j++)
            connect(providerURLs[j], j);
    }
}

class DataLoop {

    #dataLoop;
    #dataLoopLength;
    #nextDataIndex = 0;

    constructor(length) {

        this.#dataLoop = new Array(length);
        this.#dataLoopLength = length;
    }

    push(data) {

        this.#dataLoop[this.#nextDataIndex] = data;

        this.#nextDataIndex++;

        if (this.#nextDataIndex >= this.#dataLoopLength)
            this.#nextDataIndex = 0;
    }

    exists(data) {

        let checkIndex;

        for (let i = 0; i < this.#dataLoopLength; i++) {

            checkIndex = this.#nextDataIndex - 1 - i;

            if (checkIndex < 0)
                checkIndex = this.#dataLoopLength - 1 - i;

            if (this.#dataLoop[checkIndex] === data)
                return true;
        }

        return false;
    }
}

function dateTime() {

    var currentdate = new Date();

    var datetime = ((currentdate.getDate() > 9) ? (currentdate.getDate()) : ("0" + currentdate.getDate())) + "/"
        + ((currentdate.getMonth() > 8) ? (currentdate.getMonth() + 1) : ("0" + (currentdate.getMonth() + 1))) + "/"
        + (currentdate.getFullYear()) + " @ "
        + ((currentdate.getHours() > 9) ? (currentdate.getHours()) : ("0" + currentdate.getHours())) + ":"
        + ((currentdate.getMinutes() > 9) ? (currentdate.getMinutes()) : ("0" + currentdate.getMinutes())) + ":"
        + ((currentdate.getSeconds() > 9) ? (currentdate.getSeconds()) : ("0" + currentdate.getSeconds()));

    return datetime;
}

const myENV = dotenv.config({ path: "./.env" }).parsed;

const mainnetProviderURLs = ["wss://summer-frequent-pallet.matic.discover.quiknode.pro/" + myENV.mainnetQuicknode, "wss://polygon-mainnet.g.alchemy.com/v2/" + myENV.mainnetAlchemy];
const testnetProviderURLs = ["wss://ws-polygon-mumbai.chainstacklabs.com", "wss://polygon-mumbai.g.alchemy.com/v2/" + myENV.testnetAlchemy];

const mainnetProviderCount = mainnetProviderURLs.length;
let mainnetConnectedProviders = 0;
let mainnetConnectedListeners = 0;

const testnetProviderCount = testnetProviderURLs.length;
let testnetConnectedProviders = 0;
let testnetConnectedListeners = 0;

const transactions = new DataLoop(30);
const listener = new Listener();
const client = socket_ioClient.io("ws://" + myENV.mainServerAddress + ":" + myENV.backServerPort, { 'autoConnect': false, 'reconnection': true, 'reconnectionDelay': 1000, 'reconnectionAttempts': Infinity });

let connectedToMainServer = false;

let unsentTxsPacket = [];

listener.on('connUpdate', (network, connectedProviders, connectedListeners) => {

    if (network == "Mainnet") {

        mainnetConnectedProviders = connectedProviders;
        mainnetConnectedListeners = connectedListeners;
    }
    else {
        testnetConnectedProviders = connectedProviders;
        testnetConnectedListeners = connectedListeners;
    }

    console.log("[" + dateTime() + "] BackServer  >>  Mainnet: " + mainnetConnectedProviders + "/" + mainnetProviderCount + " - " + mainnetConnectedListeners + "/" + mainnetProviderCount + "  |  Testnet: " + testnetConnectedProviders + "/" + testnetProviderCount + " - " + testnetConnectedListeners + "/" + testnetProviderCount);
}).on('newTx', (network, transactionHash, verification, timestamp) => {

    if (!transactions.exists(transactionHash)) {

        if (!connectedToMainServer)
            unsentTxsPacket.push([network, transactionHash, verification, timestamp]);
        else
            client.emit('newTransaction', network, transactionHash, verification, timestamp);

        console.log("[" + dateTime() + "] BackServer  >>  " + network + " transaction received (" + transactionHash + ")");
    }
    else
        console.log("[" + dateTime() + "] BackServer  >>  " + network + " transaction received (" + transactionHash + ") - ignored");
});

client.on('connect', () => {

    connectedToMainServer = true;

    client.emit("join-room", "BackServers");
    console.log("[" + dateTime() + "] BackServer  >>  Connected to MainServer");

    if (unsentTxsPacket.length > 0) {

        let packetID = CryptoJS.SHA256(unsentTxsPacket).toString();

        client.emit('newTransactionsPacket', packetID, unsentTxsPacket);
        console.log("[" + dateTime() + "] BackServer  >>  Emitted " + unsentTxsPacket.length + " historic transaction(s)");
    }
}).on('joined-room', (room) => {

    console.log("[" + dateTime() + "] BackServer  >>  Connected with other " + room);
}).on('disconnect', () => {

    connectedToMainServer = false;

    console.log("[" + dateTime() + "] BackServer  >>  Connection to MainServer (and BackServers) lost");
}).on('pushTransaction', (transactionHash) => {

    if (!transactions.exists(transactionHash))
        transactions.push(transactionHash);
}).on('clearUnsentTxsPacket', () => {

    unsentTxsPacket = [];

    console.log("[" + dateTime() + "] BackServer  >>  Historic transaction(s) cleared");
});

client.connect();

listener.connect("Mainnet", "0x163342FAe2bBe3303e5A9ADCe4BC9fb44d0FF062", mainnetProviderURLs);
listener.connect("Testnet", "0xfc82AD7B08bC6AF0b0046ee8aE6b12df3457DE23", testnetProviderURLs);
