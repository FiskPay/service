import dotenv from "dotenv";
import sha256 from "sha256";

import Listener from "./classes/listener.js";
import DataLoop from "./classes/dataLoop.js";

import { dateTime } from "./functions/dateTools.js";

import { io } from "socket.io-client";

const myENV = dotenv.config({ path: "./server/private/.env" }).parsed;

const mainnetProviderURLs = [myENV.mainnetProvider1, myENV.mainnetProvider2];
const testnetProviderURLs = [myENV.testnetProvider1, myENV.testnetProvider2];

const mainnetProviderCount = mainnetProviderURLs.length;
let mainnetConnectedProviders = 0;

const testnetProviderCount = testnetProviderURLs.length;
let testnetConnectedProviders = 0;

const transactions = new DataLoop(30);
const listener = new Listener();
const wsClient = io("ws://" + myENV.mainServerAddress + ":" + myENV.wsPort, { "autoConnect": false, "reconnection": true, "reconnectionDelay": 1000, "reconnectionAttempts": Infinity });

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