import dotenv from "dotenv";

import DataLoop from "./classes/dataLoop.js";
import Orders from "./classes/orders.js";

import { dateTime } from "./functions/dateTools.js";

import { createServer } from "http";
import { Server } from "socket.io";

const myENV = dotenv.config({ path: "./server/private/.env" }).parsed;

const transactions = new DataLoop(30);
const packets = new DataLoop(10);

const orderstDir = "./server/private/orders/";
const serverDir = "./server/private/orderClassData/";
const orders = new Orders(orderstDir, serverDir, 1, 5);
const triggerRetryAttempts = 5;
const triggerRetrySeconds = 180;

const wsOptions = { cors: { origin: "*", credentials: true, optionSuccessStatus: 200 } };
const wsWhitelist = [myENV.backServer1Address, myENV.backServer2Address, myENV.proxyServerAddress];

const httpServer = new createServer();
const wsServer = new Server(httpServer, wsOptions);

function trigger(iOrderPath, iforce) {

    const proxyRoomData = wsServer.sockets.adapter.rooms.get("ProxyServer");

    if (proxyRoomData && proxyRoomData.size > 0) {

        const triggerObject = orders.getTriggerObject(iOrderPath);

        if (triggerObject && triggerObject.postData) {

            if (triggerObject.claimed === 0 && triggerObject.triggerCount <= triggerRetryAttempts) {

                if (iforce || (Math.floor(Date.now() / 1000) - triggerObject.triggerTimestamp) >= triggerRetrySeconds) {

                    orders.updatePendingList(iOrderPath);
                    wsServer.to("ProxyServer").emit("triggerCustomer", triggerObject.url, triggerObject.postData);  //Main to Proxy
                }
            }
            else {

                orders.removeFromPendingList(iOrderPath);
                orders.moveToFailed(iOrderPath);
            }
        }
    }
}

wsServer.on("connection", (wsClient) => {

    let wsClientAddress = wsClient.handshake.address;

    if (wsClientAddress.slice(0, 7) == "::ffff:")
        wsClientAddress = wsClientAddress.slice(7);

    if (!wsWhitelist.includes(wsClientAddress)) {

        wsClient.disconnect(true);
        console.log("[" + dateTime() + "] MainServer  >>  Client " + wsClientAddress + " connection rejected");
    }
    else {

        wsClient.on("createOrder", async (orderObject) => { //Proxy to Main

            const responseObject = await orders.createOrder(orderObject);
            wsServer.to("ProxyServer").emit("createOrderResponse", responseObject); //Main to Proxy

        }).on("claimOrder", (encryptedOrderPath, receiverWallet) => { //Proxy to Main

            const orderPath = orders.decrypt(encryptedOrderPath, receiverWallet);

            if (orderPath) {

                const responseObject = orders.claimOrder(orderPath);

                orders.removeFromPendingList(orderPath);

                if (responseObject.error == false && responseObject.data != null)
                    orders.moveToSuccessful(orderPath);
                else
                    orders.moveToFailed(orderPath);

                wsServer.to("ProxyServer").emit("claimOrderResponse", responseObject); //Main to Proxy
            }
            else
                wsServer.to("ProxyServer").emit("claimOrderResponse", false); //Main to Proxy
        }).on("newTransaction", (network, transactionHash, verification, timestamp) => { //Back to Main

            if (!transactions.exists(transactionHash)) {

                transactions.push(transactionHash);
                wsServer.to("BackServer").emit("pushTransaction", transactionHash); //Main to Back

                const orderPath = orders.setAsPaid(network, transactionHash, verification, timestamp);

                if (orderPath)
                    trigger(orderPath, true); //Main to Proxy

                //console.log("[" + dateTime() + "] MainServer  >>  " + network + " live transaction received (" + verification + ")");
            }

        }).on("newTransactionsPacket", async (packetID, transactionsPacket) => { //Back to Main

            if (!packets.exists(packetID)) {

                packets.push(packetID);

                for (let transactionData of transactionsPacket) {

                    const transactionHash = transactionData[1];

                    if (!transactions.exists(transactionHash)) {

                        transactions.push(transactionHash);
                        wsServer.to("BackServer").emit("pushTransaction", transactionHash); ////Main to Back

                        const network = transactionData[0];
                        const verification = transactionData[2];
                        const timestamp = transactionData[3];

                        const orderPath = orders.setAsPaid(network, transactionHash, verification, timestamp);

                        if (orderPath) {

                            trigger(orderPath, true); //Main to Proxy
                            await new Promise(resolve => setTimeout(resolve, 250));
                        }

                        //console.log("[" + dateTime() + "] MainServer  >>  " + network + " historic transaction received (" + verification + ")");
                    }
                };
            }

            wsClient.emit("clearTransactionsPacket"); //Main to Client

        }).on("join-room", (room) => {

            wsClient.join(room);
            wsClient.emit("joined-room", room); //Main to Client

            console.log("[" + dateTime() + "] MainServer  >>  Client " + wsClientAddress + " connected as " + room);

        }).on("disconnect", () => {

            console.log("[" + dateTime() + "] MainServer  >>  Client " + wsClientAddress + " disconnected");
        });
    }
});

httpServer.listen(myENV.wsPort, () => {

    console.log("[" + dateTime() + "] MainServer  >>  Websocket server online on port " + myENV.wsPort);

    let interval = Math.floor(triggerRetrySeconds * 1000 / 3);

    if (interval < 30000)
        interval = 30000;

    setInterval(async () => {

        const pendingOrders = orders.getPendingList();

        for (let order in pendingOrders) {

            trigger(order, false);
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }, interval);
});
