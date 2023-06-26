import dotenv from "dotenv";

import DataLoop from "./classes/dataLoop.js";
import Orders from "./classes/orders.js";

import { dateTime } from "./functions/dateTools.js";

import { createServer } from "http";
import { Server } from "socket.io";

const myENV = dotenv.config({ path: "M:/Workspaces/service/server/.env" }).parsed;

const transactions = new DataLoop(30);
const packets = new DataLoop(10);

const orderstDir = "M:/Workspaces/service/server/private/ordersBucket/";
const serverDir = "M:/Workspaces/service/server/private/serverBucket/";
const orders = new Orders(orderstDir, serverDir, 1, 5);
const triggerRetryAttempts = 5;
const triggerRetrySeconds = 120;

const websocketWhitelist = [myENV.websocketClientAddress1, myENV.websocketClientAddress2, myENV.websocketClientAddress3];
const temporaryHttpServer = new createServer();
const websocketServer = new Server();

function trigger(iOrderPath, iforce) {

    if (websocketServer.sockets.adapter.rooms.get("ProxyServer").size > 0) {

        const triggerObject = orders.getTriggerObject(iOrderPath);

        if (triggerObject && triggerObject.body) {

            if (triggerObject.claimed === 0 && triggerObject.triggerCount <= triggerRetryAttempts) {

                if (iforce || (Math.floor(Date.now() / 1000) - triggerObject.triggerTimestamp) >= triggerRetrySeconds) {

                    orders.updatePendingList(iOrderPath);
                    websocketServer.to("ProxyServer").emit("triggerCustomer", triggerObject.url, triggerObject.body);  //Main to Proxy
                }
            }
            else {

                orders.removeFromPendingList(iOrderPath);
                orders.moveToFailed(iOrderPath);
            }
        }
    }
}

websocketServer.on("connection", (websocketClient) => {

    let websocketClientAddress = websocketClient.handshake.address;

    if (websocketClientAddress.slice(0, 7) == "::ffff:")
        websocketClientAddress = websocketClientAddress.slice(7);

    if (!websocketWhitelist.includes(websocketClientAddress)) {

        websocketClient.disconnect();
        console.log("[" + dateTime() + "] MainServer  >>  Client " + websocketClientAddress + " connection rejected");
    }
    else {

        websocketClient.on("createOrder", async (orderObject) => { //Proxy to Main

            const responseObject = await orders.createOrder(orderObject);
            websocketServer.to("ProxyServer").emit("createOrderResponse", responseObject); //Main to Proxy

        }).on("claimOrder", (encryptedOrderPath) => { //Proxy to Main

            const orderPath = orders.decrypt(encryptedOrderPath);

            if (orderPath) {

                const responseObject = orders.claimOrder(orderPath);

                orders.removeFromPendingList(orderPath);

                if (responseObject.error == false && responseObject.data != null)
                    orders.moveToSuccessful(orderPath);
                else
                    orders.moveToFailed(orderPath);

                websocketServer.to("ProxyServer").emit("claimOrderResponse", responseObject); //Main to Proxy
            }
            else
                websocketServer.to("ProxyServer").emit("claimOrderResponse", false); //Main to Proxy
        }).on("newTransaction", (network, transactionHash, verification, timestamp) => { //Back to Main

            if (!transactions.exists(transactionHash)) {

                transactions.push(transactionHash);
                websocketServer.to("BackServer").emit("pushTransaction", transactionHash); //Main to Back

                const orderPath = orders.setAsPaid(network, transactionHash, verification, timestamp);

                if (orderPath)
                    trigger(orderPath, true); //Main to Proxy

                //console.log("[" + dateTime() + "] MainServer  >>  " + network + " live transaction received (" + verification + ")");
            }

        }).on("newTransactionsPacket", (packetID, transactionsPacket) => { //Back to Main

            if (!packets.exists(packetID)) {

                packets.push(packetID);

                for (let transactionData of transactionsPacket) {

                    const transactionHash = transactionData[1];

                    if (!transactions.exists(transactionHash)) {

                        transactions.push(transactionHash);
                        websocketServer.to("BackServer").emit("pushTransaction", transactionHash); ////Main to Back

                        const network = transactionData[0];
                        const verification = transactionData[2];
                        const timestamp = transactionData[3];

                        const orderPath = orders.setAsPaid(network, transactionHash, verification, timestamp);

                        if (orderPath)
                            trigger(orderPath, true); //Main to Proxy

                        //console.log("[" + dateTime() + "] MainServer  >>  " + network + " historic transaction received (" + verification + ")");
                    }
                };
            }

            websocketClient.emit("clearTransactionsPacket"); //Main to Client

        }).on("join-room", (room) => {

            websocketClient.join(room);
            websocketClient.emit("joined-room", room); //Main to Client

            console.log("[" + dateTime() + "] MainServer  >>  Client " + websocketClientAddress + " connected as " + room);

        }).on("disconnect", () => {

            console.log("[" + dateTime() + "] MainServer  >>  Client " + websocketClientAddress + " disconnected");

        });

        console.log("[" + dateTime() + "] MainServer  >>  Client " + websocketClientAddress + " connected");
    }
});

temporaryHttpServer.listen(myENV.websocketServerPort, () => {

    websocketServer.attach(temporaryHttpServer);
    console.log("[" + dateTime() + "] MainServer  >>  Websocket server online on port " + myENV.websocketServerPort);

    setInterval(() => {

        if (websocketServer.sockets.adapter.rooms.get("ProxyServer")) {

            const pendingOrders = orders.getPendingList();

            for (let order in pendingOrders)
                trigger(order, false);
        }
    }, 30000);
});
