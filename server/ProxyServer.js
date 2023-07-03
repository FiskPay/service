import dotenv from "dotenv";
import fs from "fs";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import http from "node:http";
import https from "node:https";

import { io } from "socket.io-client";

import { dateTime } from "./functions/dateTools.js";

const myENV = dotenv.config({ path: "./server/private/.env" }).parsed;

const serverHandler = new express();
serverHandler.use(cors({ origin: "*", credentials: true, optionSuccessStatus: 200 }));
serverHandler.use(express.json());
serverHandler.use(express.urlencoded({ extended: true }));
serverHandler.use((req, res, next) => {

    res.set("Connection", "close");

    if (!req.secure)
        res.redirect(301, "https://" + req.headers.host + req.url);
    else {

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
            res.connection.end();
        }
    }
});

const httpServer = http.createServer(serverHandler);
const httpsServer = https.createServer({ key: fs.readFileSync("./server/private/key.pem"), cert: fs.readFileSync("./server/private/cert.pem"), ca: fs.readFileSync("./server/private/ca.pem") }, serverHandler);

const httpAgent = new http.Agent({});
const httpsAgent = new https.Agent({});

const wsClient = io("ws://" + myENV.wsServerAddress + ":" + myENV.wsServerPort, { "autoConnect": false, "reconnection": true, "reconnectionDelay": 1000, "reconnectionAttempts": Infinity });

let connectedToMainServer = false;
/*let pendingCreate = 0;
let pendingClaim = 0;
let unservedCreate = 0;
let unservedClaim = 0;*/

serverHandler.post("/createOrder*", async (req, res) => {

    if (!connectedToMainServer) {

        /*unservedCreate++;
        console.log("[" + dateTime() + "] ProxyServer  >>  Create request could not be served (" + unservedCreate + " total)");*/

        let responseObject = new Object();
        responseObject.error = true;
        responseObject.message = "Service unavailable";
        responseObject.data = {};

        res.status(200).type("json").send(JSON.stringify(responseObject)).end();
        res.connection.end();
    }
    else {

        /*pendingCreate++;
        console.log("[" + dateTime() + "] ProxyServer  >>  New create request. Awaiting response for " + pendingCreate + " order(s)");*/

        wsClient.emit("createOrder", req.body);

        let responseObject = await new Promise((resolve) => {

            let timeout;

            wsClient.once("createOrderResponse", (responseObject) => {

                /*pendingCreate--;
                console.log("[" + dateTime() + "] ProxyServer  >>  Created " + responseObject.data.verification + " (" + responseObject.data.network + ")");
    
                if (pendingCreate <= 0)
                    console.log("[" + dateTime() + "] ProxyServer  >>  All creates served");*/

                clearTimeout(timeout);
                resolve(responseObject);
            });

            timeout = setTimeout(() => {

                let responseObject = new Object();
                responseObject.error = true;
                responseObject.message = "Request timed out";
                responseObject.data = {};

                resolve(responseObject);

            }, 15000);
        });

        res.status(200).type("json").send(JSON.stringify(responseObject)).end();
        res.connection.end();
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
        res.connection.end();
    }
    else {

        /*pendingClaim++;
        console.log("[" + dateTime() + "] ProxyServer  >>  New claim request. Awaiting response for " + pendingClaim + " order(s)");*/

        wsClient.emit("claimOrder", req.params.order);

        let responseObject = await new Promise((resolve) => {

            let timeout;

            wsClient.once("claimOrderResponse", (responseObject) => {

                /*pendingClaim--;
    
                if (responseObject.error == false) {
    
                    const protocol = req.protocol;
                    const hostHeaderIndex = req.rawHeaders.indexOf("Host") + 1;
                    const host = hostHeaderIndex ? req.rawHeaders[hostHeaderIndex] : undefined;
    
                    let claimer = protocol + "://" + host;
    
                    if (!host)
                        claimer = req.headers.referer ? req.headers.referer.substring(0, req.headers.referer.length - 1) : undefined;
    
                    console.log("[" + dateTime() + "] ProxyServer  >>  Claimed " + responseObject.data.order.verification + " (" + claimer + ")");
                }
                else
                    console.log("[" + dateTime() + "] ProxyServer  >>  Claim errored with message: " + responseObject.message);
    
                if (pendingClaim <= 0)
                    console.log("[" + dateTime() + "] ProxyServer  >>  All claims served");*/

                clearTimeout(timeout);
                resolve(responseObject);
            });

            timeout = setTimeout(() => {

                let responseObject = new Object();
                responseObject.error = true;
                responseObject.message = "Request timed out";
                responseObject.data = {};

                resolve(responseObject);

            }, 15000);
        });

        res.status(200).type("json").send(JSON.stringify(responseObject)).end();
        res.connection.end();
    }
}).all("*", (req, res) => {

    res.status(404).type("html").send("<h1>404! Page not found</h1>").end();
    res.connection.end();
});

wsClient.on("triggerCustomer", async (iUrl, iPostData) => {

    //console.log("[" + dateTime() + "] ProxyServer  >>  Triggering " + iUrl);

    try {

        const urlProtocol = new URL(iUrl).protocol;

        await fetch(iUrl, {

            method: "post",
            headers: {
                "Accept": "text/plain",
                "Content-Type": "text/plain"
            },
            body: iPostData,
            agent: () => {
                if (urlProtocol == "http:")
                    return httpAgent;
                else
                    return httpsAgent;
            }
        });
    }
    catch (e) {

        //console.log("[" + dateTime() + "] ProxyServer  >>  Triggering " + iUrl + " failed");
    }

}).on("connect", () => {

    connectedToMainServer = true;
    /*unservedCreate = 0;
    unservedClaim = 0;*/

    wsClient.emit("join-room", "ProxyServer");

}).on("joined-room", (room) => {

    console.log("[" + dateTime() + "] ProxyServer  >>  Connected as " + room);

}).on("disconnect", () => {

    connectedToMainServer = false;

    console.log("[" + dateTime() + "] ProxyServer  >>  Connection lost");
});

httpServer.listen(myENV.httpServerPort, () => {

    console.log("[" + dateTime() + "] ProxyServer  >>  Http server online on port " + myENV.httpServerPort);
});

httpsServer.listen(myENV.httpsServerPort, () => {

    console.log("[" + dateTime() + "] ProxyServer  >>  Https server online on port " + myENV.httpsServerPort);
});

wsClient.connect();