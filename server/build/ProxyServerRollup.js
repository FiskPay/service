'use strict';

var dotenv = require('dotenv');
var express = require('express');
var cors = require('cors');
var fetch = require('node-fetch');
var http = require('http');
var socket_ioClient = require('socket.io-client');

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

const myENV = dotenv.config({ path: "M:/Workspaces/service/server/.env" }).parsed;

const httpServerHandler = new express();
const corsOptions = { origin: "*", credentials: true, optionSuccessStatus: 200 };

httpServerHandler.use(cors(corsOptions));
httpServerHandler.use(express.json());
httpServerHandler.use(express.urlencoded({ extended: true }));
httpServerHandler.use((req, res, next) => {

    try {

        decodeURIComponent(req.path);
        next();
    }
    catch (e) {

        //console.log("[" + dateTime() + "] ProxyServer  >>  Request URI not parsable");

        let responseObject = new Object();
        responseObject.error = true;
        responseObject.message = "URI not parsable";
        responseObject.data = {};

        res.status(200).type("json").send(JSON.stringify(responseObject)).end();
    }
});

const httpServer = new http.createServer(httpServerHandler);
const client = socket_ioClient.io("ws://" + myENV.mainServerAddress + ":" + myENV.websocketServerPort, { 'autoConnect': false, 'reconnection': true, 'reconnectionDelay': 1000, 'reconnectionAttempts': Infinity });

let connectedToMainServer = false;
/*let pendingCreate = 0;
let pendingClaim = 0;
let unservedCreate = 0;
let unservedClaim = 0;*/

httpServerHandler.post("/createOrder*", async (req, res) => {

    if (!connectedToMainServer) {

        /*unservedCreate++;
        console.log("[" + dateTime() + "] ProxyServer  >>  Create request could not be served (" + unservedCreate + " total)");*/

        let responseObject = new Object();
        responseObject.error = true;
        responseObject.message = "Service unavailable";
        responseObject.data = {};

        res.status(200).type("json").send(JSON.stringify(responseObject)).end();
    }
    else {

        /*pendingCreate++;
        console.log("[" + dateTime() + "] ProxyServer  >>  New create request. Awaiting response for " + pendingCreate + " order(s)");*/

        client.emit("createOrder", req.body);

        let responseObject = await new Promise((resolve) => {

            client.once("createOrderResponse", (responseObject) => {

                /*pendingCreate--;
                console.log("[" + dateTime() + "] ProxyServer  >>  Created " + responseObject.data.verification + " (" + responseObject.data.network + ")");

                if (pendingCreate <= 0)
                    console.log("[" + dateTime() + "] ProxyServer  >>  All creates served");*/

                resolve(responseObject);
            });
        });

        res.status(200).type("json").send(JSON.stringify(responseObject)).end();
    }

}).get("/claimOrder/:order", async (req, res) => {

    if (!connectedToMainServer) {

        /*unservedClaim++;
        console.log("[" + dateTime() + "] ProxyServer  >>  Claim request could not be served (" + unservedClaim + " total)");*/

        let responseObject = new Object();
        responseObject.error = true;
        responseObject.message = "Service unavailable";
        responseObject.data = {};

        res.status(200).type("json").send(JSON.stringify(responseObject)).end();
    }
    else {

        /*pendingClaim++;
        console.log("[" + dateTime() + "] ProxyServer  >>  New claim request. Awaiting response for " + pendingClaim + " order(s)");*/

        client.emit("claimOrder", req.params.order);

        let responseObject = await new Promise((resolve) => {

            client.once("claimOrderResponse", (responseObject) => {

                /*pendingClaim--;

                if (responseObject.error == false) {

                    const protocol = req.protocol;
                    const hostHeaderIndex = req.rawHeaders.indexOf('Host') + 1;
                    const host = hostHeaderIndex ? req.rawHeaders[hostHeaderIndex] : undefined;

                    let claimer = protocol + '://' + host;

                    if (!host)
                        claimer = req.headers.referer ? req.headers.referer.substring(0, req.headers.referer.length - 1) : undefined;

                    console.log("[" + dateTime() + "] ProxyServer  >>  Claimed " + responseObject.data.order.verification + " (" + claimer + ")");
                }
                else
                    console.log("[" + dateTime() + "] ProxyServer  >>  Claim errored with message: " + responseObject.message);

                if (pendingClaim <= 0)
                    console.log("[" + dateTime() + "] ProxyServer  >>  All claims served");*/

                resolve(responseObject);
            });
        });

        res.status(200).type("json").send(JSON.stringify(responseObject)).end();
    }
}).all("*", (req, res) => {

    res.status(404).type("html").send("<h1>404! Page not found</h1>").end();
});

client.on("triggerCustomer", (iURL, iBody) => {

    //console.log("[" + dateTime() + "] ProxyServer  >>  Triggering " + iURL);

    fetch(iURL, {

        method: "post",
        headers: {
            'Accept': 'text/plain',
            'Content-Type': 'text/plain'
        },
        body: iBody
    });

}).on("connect", () => {

    connectedToMainServer = true;
    /*unservedCreate = 0;
    unservedClaim = 0;*/

    client.emit("join-room", "ProxyServer");
    console.log("[" + dateTime() + "] ProxyServer  >>  Connected to MainServer");

}).on("joined-room", (room) => {

    console.log("[" + dateTime() + "] ProxyServer  >>  Connected as " + room);

}).on("disconnect", () => {

    connectedToMainServer = false;

    console.log("[" + dateTime() + "] ProxyServer  >>  Connection to MainServer lost");

});

httpServer.listen(myENV.httpServerPort, () => {

    console.log("[" + dateTime() + "] ProxyServer  >>  Http server online on port " + myENV.httpServerPort);

    client.connect();
});
