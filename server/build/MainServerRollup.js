'use strict';

var fs = require('fs');
var dotenv = require('dotenv');
var http = require('http');
var socket_io = require('socket.io');
var events = require('events');

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

new DataLoop();
const emitter = new events.EventEmitter();

const transactions = new DataLoop(30);
const packets = new DataLoop(10);

const backServersWhitelist = [myENV.backServerAddress1, myENV.backServerAddress2];
const backServerHttp = new http.createServer();
const backServerSocket = new socket_io.Server();

const proxyServerAddress = myENV.proxyServerAddress;
const proxyServerHttp = new http.createServer();
const proxyServerSocket = new socket_io.Server();

const bucketDir = "./orderBucket/";

backServerSocket.on("connection", (backClient) => {

    let backClientAddress = backClient.handshake.address;

    if (backClientAddress.slice(0, 7) == "::ffff:")
        backClientAddress = backClientAddress.slice(7);

    if (!backServersWhitelist.includes(backClientAddress)) {

        backClient.disconnect();
        console.log("[" + dateTime() + "] MainServer  >>  BackServer " + backClientAddress + " connection rejected");
    }
    else {

        function updateAndForward(network, transactionHash, verification, timestamp) {

            let orderFileName = network + "_" + timestamp + "_" + verification + ".json";
            let orderFilePath = bucketDir + orderFileName;

            if (fs.existsSync(orderFilePath)) {

                fs.stat(orderFilePath, (error, fileStats) => {

                    if (!error) {

                        let creationTimestamp = Math.floor(fileStats.ctimeMs);
                        let appendTimestamp = Math.floor(fileStats.atimeMs);

                        if (appendTimestamp - creationTimestamp < 1000) {

                            var orderString = fs.readFileSync(orderFilePath, "utf8");
                            var orderObject = JSON.parse(orderString);

                            if (orderObject.txHash === null && orderObject.claimCounter === null) {

                                orderObject.txHash = transactionHash;
                                orderObject.claimCounter = 0;

                                fs.writeFileSync(orderFilePath, JSON.stringify(orderObject), "utf8");

                                emitter.emit("pushOrderFilePathToProxy", orderFilePath);
                            }
                        }
                    }
                });
            }
        }

        backClient.on('join-room', (room) => {

            backClient.join(room);
            backClient.emit('joined-room', room);
            console.log("[" + dateTime() + "] MainServer  >>  BackServer " + backClientAddress + " has joined " + room);
        }).on('newTransaction', (network, transactionHash, verification, timestamp) => {

            if (!transactions.exists(transactionHash)) {

                transactions.push(transactionHash);
                backClient.to("BackServers").emit('pushTransaction', transactionHash);

                updateAndForward(network, transactionHash, verification, timestamp);

                console.log("[" + dateTime() + "] MainServer  >>  " + network + " live transaction received (" + transactionHash + ")");
            }
        }).on('newTransactionsPacket', (packetID, unsentTxsPacket) => {

            if (!packets.exists(packetID)) {

                packets.push(packetID);

                unsentTxsPacket.forEach(transactionData => {

                    let transactionHash = transactionData[1];

                    if (!transactions.exists(transactionHash)) {

                        transactions.push(transactionHash);
                        backClient.to("BackServers").emit('pushTransaction', transactionHash);

                        let network = transactionData[0];
                        let verification = transactionData[2];
                        let timestamp = transactionData[3];

                        updateAndForward(network, transactionHash, verification, timestamp);

                        console.log("[" + dateTime() + "] MainServer  >>  " + network + " historic transaction received (" + transactionHash + ")");
                    }
                });
            }

            backClient.emit('clearUnsentTxsPacket');
        }).on('disconnect', () => {

            console.log("[" + dateTime() + "] MainServer  >>  BackServer " + backClientAddress + " disconnected");
        });

        console.log("[" + dateTime() + "] MainServer  >>  BackServer " + backClientAddress + " connected");
    }
});

proxyServerSocket.on("connection", (proxyClient) => {

    const newAESSeed = (Math.floor(Math.random() * 1234567890.0) + myENV.extraAESSeed).toString(36);

    let proxyClientAddress = proxyClient.handshake.address;

    if (proxyClientAddress.slice(0, 7) == "::ffff:")
        proxyClientAddress = proxyClientAddress.slice(7);

    if (proxyServerAddress != proxyClientAddress) {

        proxyClient.disconnect();
        console.log("[" + dateTime() + "] MainServer  >>  BackServer " + proxyClientAddress + " connected");
    }
    else {

        function triggerCustomer(orderFilePath) {

            if (fs.existsSync(orderFilePath)) {

                var txString = fs.readFileSync(orderFilePath, "utf8");
                var txObject = JSON.parse(txString);

                if (txObject.txHash !== null && txObject.claimCounter === 0) ;
            }
        }

        proxyClient.on('newOrder', (jsonString) => {



        }).on('claimOrder', (jsonString) => {



        }).on('aesSeedReceived', () => {

            console.log("[" + dateTime() + "] MainServer  >>  ProxyServer " + clientAddress + " received AES seed");
        });

        emitter.on("pushOrderFilePathToProxy", (orderFilePath) => {

            triggerCustomer(orderFilePath);
        });

        console.log("[" + dateTime() + "] MainServer  >>  ProxyServer " + clientAddress + " connected");

        proxyClient.emit('aesSeed', newAESSeed);
    }
});

backServerHttp.listen(myENV.backServerPort);
backServerSocket.attach(backServerHttp);

console.log("[" + dateTime() + "] MainServer  >>  BackServer websocket online on port " + myENV.backServerPort);

setTimeout(() => {

    proxyServerHttp.listen(myENV.proxyServerPort);
    proxyServerSocket.attach(proxyServerHttp);

    console.log("[" + dateTime() + "] MainServer  >>  ProxyServer websocket online on port " + myENV.proxyServerPort);
}, 2500);
