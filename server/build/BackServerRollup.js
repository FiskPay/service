'use strict';

var dotenv = require('dotenv');
var sha256 = require('sha256');
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

                const web3Instance = new Web3(Providers[providerIndex]);

                if (processorAddress == "0x0000000000000000000000000000000000000000") {

                    const parentContract = new web3Instance.eth.Contract(PARENT_ABI, parentAddress);

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

                connectedProviders--;
                this.emit('providerChange', network, connectedProviders);

                let pollingReconnection = setInterval(() => {

                    if (!wasConnected[providerIndex])
                        connect(providerURL, providerIndex);
                    else
                        clearInterval(pollingReconnection);
                }, reconnectAftenMilliseconds);
            }
        };

        const listen = (web3Instance) => {

            const processorContract = new web3Instance.eth.Contract(PROCESSOR_ABI, processorAddress);

            processorContract.events.Processed((error, data) => {

                if (!error) {

                    const transactionHash = data.transactionHash;
                    const verification = data.returnValues.verification;
                    const timestamp = data.returnValues.timestamp;

                    const tnow = Math.floor(Date.now() / 1000);
                    const expire = Number(timestamp) + 905;

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

                            this.emit('newTransaction', network, transactionHash, verification, timestamp);
                        }
                    }
                }
                else
                    console.log(error);
            });

            connectedProviders++;
            this.emit('providerChange', network, connectedProviders);

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

    const currentdate = new Date();

    const datetime = ((currentdate.getDate() > 9) ? (currentdate.getDate()) : ("0" + currentdate.getDate())) + "/"
        + ((currentdate.getMonth() > 8) ? (currentdate.getMonth() + 1) : ("0" + (currentdate.getMonth() + 1))) + "/"
        + (currentdate.getFullYear()) + " @ "
        + ((currentdate.getHours() > 9) ? (currentdate.getHours()) : ("0" + currentdate.getHours())) + ":"
        + ((currentdate.getMinutes() > 9) ? (currentdate.getMinutes()) : ("0" + currentdate.getMinutes())) + ":"
        + ((currentdate.getSeconds() > 9) ? (currentdate.getSeconds()) : ("0" + currentdate.getSeconds()));

    return datetime;
}

const myENV = dotenv.config({ path: "./server/private/.env" }).parsed;

const mainnetProviderURLs = [myENV.mainnetProvider1, myENV.mainnetProvider2];
const testnetProviderURLs = [myENV.testnetProvider1, myENV.testnetProvider2];

const mainnetProviderCount = mainnetProviderURLs.length;
let mainnetConnectedProviders = 0;

const testnetProviderCount = testnetProviderURLs.length;
let testnetConnectedProviders = 0;

const transactions = new DataLoop(30);
const listener = new Listener();
const wsClient = socket_ioClient.io("ws://" + myENV.mainServerAddress + ":" + myENV.wsPort, { "autoConnect": false, "reconnection": true, "reconnectionDelay": 1000, "reconnectionAttempts": Infinity });

let connectedToMainServer = false;
let transactionsPacket = new Array();

listener.on("providerChange", (network, connectedProviders) => {

    if (network == "0x89")
        mainnetConnectedProviders = connectedProviders;
    else
        testnetConnectedProviders = connectedProviders;

    console.log("[" + dateTime() + "] BackServer  >>  0x89: " + mainnetConnectedProviders + "/" + mainnetProviderCount + "  |  0x13881: " + testnetConnectedProviders + "/" + testnetProviderCount);

}).on("newTransaction", (network, transactionHash, verification, timestamp) => {

    if (!transactions.exists(transactionHash)) {

        if (!connectedToMainServer)
            transactionsPacket.push([network, transactionHash, verification, timestamp]);
        else
            wsClient.emit("newTransaction", network, transactionHash, verification, timestamp);

        //console.log("[" + dateTime() + "] BackServer  >>  " + network + " transaction received (" + verification + ")");
    }
    /*else
        console.log("[" + dateTime() + "] BackServer  >>  " + network + " transaction received (" + verification + ") - ignored");*/

});

wsClient.on("pushTransaction", (transactionHash) => {

    if (!transactions.exists(transactionHash))
        transactions.push(transactionHash);

}).on("clearTransactionsPacket", () => {

    transactionsPacket = [];
    //console.log("[" + dateTime() + "] BackServer  >>  Historic transaction(s) cleared");

}).on("connect", () => {

    connectedToMainServer = true;

    wsClient.emit("join-room", "BackServer");

    if (transactionsPacket.length > 0) {

        const packetID = sha256(transactionsPacket).toString();

        wsClient.emit("newTransactionsPacket", packetID, transactionsPacket);
        //console.log("[" + dateTime() + "] BackServer  >>  Emitted " + transactionsPacket.length + " historic transaction(s)");
    }

}).on("joined-room", (room) => {

    console.log("[" + dateTime() + "] BackServer  >>  Connected as " + room);

}).on("disconnect", () => {

    connectedToMainServer = false;
    console.log("[" + dateTime() + "] BackServer  >>  Connection lost");

});

wsClient.connect();

listener.connect("0x89", "0x163342FAe2bBe3303e5A9ADCe4BC9fb44d0FF062", mainnetProviderURLs);
listener.connect("0x13881", "0xfc82AD7B08bC6AF0b0046ee8aE6b12df3457DE23", testnetProviderURLs);
