import fs from "fs";
import dotenv from "dotenv";
import EventEmitter from "events";
import fetch from "node-fetch";
import sha256 from "sha256";
import AES from "./aes.js";

import { toDateFolder } from '../functions/dateTools.js';

export default class Orders extends EventEmitter {

    #myENV;

    #ordersDir;

    #pendingOrdersPath;
    #supportedCryptoPath;
    #supportedFiatPath;

    #cryptoInterval;
    #fiatInterval;

    #pendingOrdersObject = new Object();
    #supportedCryptoObject = new Object();
    #supportedFiatObject = new Object();

    constructor(ordersDir, serverDir, cryptoUpdateInSeconds, fiatUpdateInSeconds) {

        super();

        this.#myENV = dotenv.config({ path: "./server/private/.env" }).parsed;

        this.#ordersDir = ordersDir;

        this.#pendingOrdersPath = serverDir + "pendingOrders.json";
        this.#supportedCryptoPath = serverDir + "supportedCrypto.json";
        this.#supportedFiatPath = serverDir + "supportedFiat.json";

        this.#cryptoInterval = cryptoUpdateInSeconds * 1000;
        this.#fiatInterval = fiatUpdateInSeconds * 1000;

        if (fs.existsSync(this.#pendingOrdersPath))
            this.#pendingOrdersObject = JSON.parse(fs.readFileSync((this.#pendingOrdersPath), { flag: "r", encoding: "utf8" }));

        if (fs.existsSync(this.#supportedCryptoPath))
            this.#supportedCryptoObject = JSON.parse(fs.readFileSync((this.#supportedCryptoPath), { flag: "r", encoding: "utf8" }));
        else
            throw new Error("File supportedCrypto.json does not exist");

        if (fs.existsSync(this.#supportedFiatPath))
            this.#supportedFiatObject = JSON.parse(fs.readFileSync((this.#supportedFiatPath), { flag: "r", encoding: "utf8" }));

        this.#updateCrypto(true);
        this.#updateFiat(true);
    }

    #isValidOrderObject(iOrderObject) {

        if (!iOrderObject)
            return false;

        let pattern = (/^0x[0-9]{1,6}$/);

        if (!(iOrderObject.network != undefined && pattern.test(iOrderObject.network)))
            return false;

        pattern = (/^0x[a-fA-F0-9]{40}$/);

        if (!(iOrderObject.senderAddress != undefined && pattern.test(iOrderObject.senderAddress)))
            return false;

        if (!(iOrderObject.receiverAddress != undefined && pattern.test(iOrderObject.receiverAddress)))
            return false;

        pattern = (/^[a-zA-Z]{3,6}$/);

        if (!(iOrderObject.cryptoSymbol != undefined && pattern.test(iOrderObject.cryptoSymbol)))
            return false;

        pattern = (/^[a-zA-Z]{3}$/);

        if (!(iOrderObject.fiatSymbol != undefined && (pattern.test(iOrderObject.fiatSymbol) || iOrderObject.fiatSymbol == "crypto")))
            return false;

        pattern = (/^[0-9]+(\.[0-9]+)?$/);

        if (!(iOrderObject.amount != undefined && pattern.test(iOrderObject.amount)))
            return false;

        if (iOrderObject.amount.length > 15)
            return false;

        pattern = (/^https?:\/\/(((www\.)?(([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,7}))|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))(:(6553[0-5]|655[0-2][0-9]|65[0-4][0-9]{2}|6[0-4][0-9]{3}|[1-5][0-9]{4}|[0-9]{1,4}))?(\/[a-zA-Z0-9_\-]+)*(\.[a-zA-Z]{1,5})?$/);

        if (!(iOrderObject.postURL != undefined && pattern.test(iOrderObject.postURL)))
            return false;

        pattern = (/exec\((.*)\)/);

        if (iOrderObject.postItem1 == undefined || pattern.test(iOrderObject.postItem1))
            return false;

        if (iOrderObject.postItem2 == undefined || pattern.test(iOrderObject.postItem2))
            return false;

        if (iOrderObject.postItem3 == undefined || pattern.test(iOrderObject.postItem3))
            return false;

        if (iOrderObject.postItem4 == undefined || pattern.test(iOrderObject.postItem4))
            return false;

        return true;
    }

    #isSupportedNetwork(iNetwork) {

        return (iNetwork == "0x89" || iNetwork == "0x13881");
    }

    #isSupportedCrypto(iCrypto) {

        return (this.#supportedCryptoObject.crypto)[iCrypto] != undefined;
    }

    #isSupportedFiat(iFiat) {

        return ((iFiat == "crypto") ? (true) : ((this.#supportedFiatObject.fiat)[iFiat] != undefined));
    }

    #processOrder(iOrderObject) {

        function float2Integer(inputAmount, inputDecimals) {

            let amount = inputAmount.toFixed(inputDecimals);
            const dotPosition = amount.indexOf(".");

            amount = amount.replace(/\./, "");

            if (dotPosition >= 0) {

                while (amount.length < dotPosition + inputDecimals)
                    amount = amount + "0";

                amount = amount.slice(0, dotPosition + inputDecimals);
            }
            else
                for (let i = 0; i < inputDecimals; i++)
                    amount = amount + "0";

            while (Array.from(amount)[0] == "0")
                amount = amount.slice(1);

            if (amount == "")
                amount = "0";

            return amount;
        }

        const cryptoSymbol = iOrderObject.cryptoSymbol;
        const cryptoDecimals = this.#supportedCryptoObject.crypto[cryptoSymbol].decimals;
        const cryptoPrice = Number(this.#supportedCryptoObject.crypto[cryptoSymbol].USDPrice);

        const fiatSymbol = iOrderObject.fiatSymbol;
        const fiatPrice = (fiatSymbol != "crypto") ? Number((1 / this.#supportedFiatObject.fiat[fiatSymbol])) : (null);

        const amount = Number(iOrderObject.amount);
        const multiplier = (fiatSymbol != "crypto") ? (1 / (cryptoPrice * fiatPrice)) : (1);

        const payAmountFloat = Number((amount * multiplier).toFixed(18));

        const cryptoAmountFloat = payAmountFloat.toFixed(6);
        const cryptoAmountInteger = float2Integer(payAmountFloat, cryptoDecimals);
        const cryptoTotalUSDValue = (payAmountFloat * cryptoPrice).toFixed(6);
        const cryptoUnitUSDValue = cryptoPrice.toFixed(6);

        const fiatAmountFloat = (fiatSymbol != "crypto") ? (amount.toFixed(6)) : (null);
        const fiatTotalUSDValue = (fiatSymbol != "crypto") ? ((amount * fiatPrice).toFixed(6)) : (null);
        const fiatUnitUSDValue = (fiatSymbol != "crypto") ? (fiatPrice.toFixed(6)) : (null);

        return [cryptoAmountFloat, cryptoAmountInteger, cryptoTotalUSDValue, cryptoUnitUSDValue, fiatAmountFloat, fiatTotalUSDValue, fiatUnitUSDValue]
    }

    #orderVerification(iSymbol, iSender, iReceiver, iAmount, iTimestamp) {

        function hex2Ascii(hexString) {

            let ascii = "";

            for (let i = 0; i < hexString.length; i += 2)
                ascii += String.fromCharCode(parseInt(hexString.substr(i, 2), 16));

            return ascii;
        }

        let hexAmount = BigInt(iAmount).toString(16);
        let hexTimestamp = BigInt(iTimestamp).toString(16);

        while (hexAmount.length < 64)
            hexAmount = "0" + hexAmount;

        while (hexTimestamp.length < 8)
            hexTimestamp = "0" + hexTimestamp;

        const asciiSender = hex2Ascii(iSender.slice(2));
        const asciiReceiver = hex2Ascii(iReceiver.slice(2));
        const asciiAmount = hex2Ascii(hexAmount);
        const asciiTimestamp = hex2Ascii(hexTimestamp);

        return "0x" + sha256(iSymbol + asciiSender + asciiReceiver + asciiAmount + asciiTimestamp).toString();
    }

    #encryptData(iData, iKey) {

        const tmp = new AES().encrypt(iData, this.#myENV.ordersAESSeed + iKey.toLowerCase());

        return Buffer.from(tmp, "ascii").toString("base64");
    }

    decrypt(iData, iKey) {

        const tmp = Buffer.from(iData.toString(), "base64").toString("ascii");

        return new AES().decrypt(tmp, this.#myENV.ordersAESSeed + iKey.toLowerCase());
    }

    async #updateCrypto(forceUpdate) {

        const tnow = Math.floor(Date.now() / 1000);
        const deltaTime = tnow - this.#supportedCryptoObject.lastUpdate;

        if (forceUpdate || deltaTime > this.#cryptoInterval) {

            let addresses = "";

            for (let symbol in this.#supportedCryptoObject.crypto)
                addresses += this.#supportedCryptoObject.crypto[symbol].address + ",";

            const fetchResponse = await fetch(this.#myENV.coinGecko + addresses);
            const fetchObject = await fetchResponse.json();

            for (let symbol in this.#supportedCryptoObject.crypto) {

                const lowAddress = (this.#supportedCryptoObject.crypto[symbol].address).toLowerCase();

                if (fetchObject[lowAddress] != undefined && fetchObject[lowAddress].usd != undefined)
                    this.#supportedCryptoObject.crypto[symbol].USDPrice = fetchObject[lowAddress].usd;
            }

            this.#supportedCryptoObject.lastUpdate = tnow;

            fs.writeFileSync(this.#supportedCryptoPath, JSON.stringify(this.#supportedCryptoObject), { flag: "w", encoding: "utf8" });
        }
    }

    async #updateFiat(forceUpdate) {

        const tnow = Math.floor(Date.now() / 1000);
        const deltaTime = (this.#supportedFiatObject !== undefined) ? (tnow - this.#supportedFiatObject.lastUpdate) : 99999999;

        if (forceUpdate || deltaTime > this.#fiatInterval) {

            const fetchResponse = await fetch(this.#myENV.currencyScoop);
            const fetchObject = await fetchResponse.json();

            if (fetchObject.response != undefined && fetchObject.response.rates != undefined) {

                this.#supportedFiatObject.fiat = fetchObject.response.rates;
                this.#supportedFiatObject.lastUpdate = tnow;

                fs.writeFileSync(this.#supportedFiatPath, JSON.stringify(this.#supportedFiatObject), { flag: "w", encoding: "utf8" });
            }
        }
    }

    async createOrder(iOrderObject) {

        let responseObject = new Object();
        responseObject.error = false;
        responseObject.message = null;
        responseObject.data = {};

        if (!this.#isValidOrderObject(iOrderObject)) {

            responseObject.error = true;
            responseObject.message = "Invalid order parameter(s)";

            return responseObject;
        }

        if (!this.#isSupportedNetwork(iOrderObject.network)) {

            responseObject.error = true;
            responseObject.message = "Unsupported network";

            return responseObject;
        }

        if (!this.#isSupportedCrypto(iOrderObject.cryptoSymbol)) {

            responseObject.error = true;
            responseObject.message = "Unsupported crypto";

            return responseObject;
        }

        if (!this.#isSupportedFiat(iOrderObject.fiatSymbol)) {

            responseObject.error = true;
            responseObject.message = "Unsupported fiat";

            return responseObject;
        }

        await Promise.all([this.#updateCrypto(false), this.#updateFiat(false)]);

        const tnow = Math.floor(Date.now() / 1000);
        const [cryptoAmountFloat, cryptoAmountInteger, cryptoTotalUSDValue, cryptoUnitUSDValue, fiatAmountFloat, fiatTotalUSDValue, fiatUnitUSDValue] = this.#processOrder(iOrderObject);
        const verification = this.#orderVerification(iOrderObject.cryptoSymbol, iOrderObject.senderAddress, iOrderObject.receiverAddress, cryptoAmountInteger, tnow);

        const newOrderDirPath = this.#ordersDir + toDateFolder(tnow) + "/new/" + iOrderObject.network + "/";
        const newOrderFilePath = newOrderDirPath + verification + ".json";

        if (fs.existsSync(newOrderFilePath)) {

            responseObject.error = true;
            responseObject.message = "Order duplicate"

            return responseObject;
        }

        let newOrderObject = {

            "lastUpdate": null,

            "order": {
                "network": null,
                "timestamp": null,
                "verification": null,

                "txHash": null,
                "sender": null,
                "receiver": null,

                "cryptoCurrency": {
                    "symbol": null,
                    "amount": null,
                    "totalUSDValue": null,
                    "unitUSDValue": null
                },

                "fiatCurrency": {
                    "symbol": null,
                    "amount": null,
                    "totalUSDValue": null,
                    "unitUSDValue": null
                },

                "postData": {
                    "url": null,
                    "item1": null,
                    "item2": null,
                    "item3": null,
                    "item4": null
                },

                "claimCounter": null
            }
        };

        newOrderObject.lastUpdate = tnow;

        newOrderObject.order.network = iOrderObject.network;
        newOrderObject.order.timestamp = String(tnow);
        newOrderObject.order.verification = verification;

        newOrderObject.order.sender = iOrderObject.senderAddress;
        newOrderObject.order.receiver = iOrderObject.receiverAddress;

        newOrderObject.order.cryptoCurrency.symbol = iOrderObject.cryptoSymbol;
        newOrderObject.order.cryptoCurrency.amount = cryptoAmountFloat;
        newOrderObject.order.cryptoCurrency.totalUSDValue = cryptoTotalUSDValue;
        newOrderObject.order.cryptoCurrency.unitUSDValue = cryptoUnitUSDValue;

        if ((iOrderObject.fiatSymbol) != "crypto") {

            newOrderObject.order.fiatCurrency.symbol = iOrderObject.fiatSymbol;
            newOrderObject.order.fiatCurrency.amount = fiatAmountFloat;
            newOrderObject.order.fiatCurrency.totalUSDValue = fiatTotalUSDValue;
            newOrderObject.order.fiatCurrency.unitUSDValue = fiatUnitUSDValue;
        }

        newOrderObject.order.postData.url = iOrderObject.postURL;
        newOrderObject.order.postData.item1 = iOrderObject.postItem1;
        newOrderObject.order.postData.item2 = iOrderObject.postItem2;
        newOrderObject.order.postData.item3 = iOrderObject.postItem3;
        newOrderObject.order.postData.item4 = iOrderObject.postItem4;

        if (!fs.existsSync(newOrderDirPath))
            fs.mkdirSync(newOrderDirPath, { recursive: true });

        fs.writeFileSync(newOrderFilePath, JSON.stringify(newOrderObject), { flag: "w", encoding: "utf8" });

        responseObject.data.amount = cryptoAmountInteger;
        responseObject.data.network = newOrderObject.order.network;
        responseObject.data.verification = newOrderObject.order.verification;
        responseObject.data.timestamp = newOrderObject.order.timestamp;

        return responseObject;
    }

    claimOrder(iOrderFilePath) {

        let responseObject = new Object();
        responseObject.error = false;
        responseObject.message = null;
        responseObject.data = {};

        if (!fs.existsSync(iOrderFilePath) || this.#pendingOrdersObject[iOrderFilePath] === undefined) {

            responseObject.error = true;
            responseObject.message = "Order not found";

            return responseObject;
        }

        let orderObject = JSON.parse(fs.readFileSync((iOrderFilePath), { flag: "r", encoding: "utf8" }));

        if (orderObject.order.claimCounter > 0) {

            responseObject.error = true;
            responseObject.message = "Already Claimed";

            return responseObject;
        }

        orderObject.lastUpdate = Math.floor(Date.now() / 1000);
        orderObject.order.claimCounter++;

        fs.writeFileSync(iOrderFilePath, JSON.stringify(orderObject), { flag: "w", encoding: "utf8" });

        delete orderObject.lastUpdate;
        delete orderObject.order.claimCounter;
        delete orderObject.order.postData.url;

        responseObject.data = orderObject;

        return responseObject;
    }

    setAsPaid(iNetwork, iTransactionHash, iVerification, iTimestamp) {

        const newOrderDirPath = this.#ordersDir + toDateFolder(iTimestamp) + "/new/" + iNetwork + "/";
        const newOrderFilePath = newOrderDirPath + iVerification + ".json";

        const paidOrderDirPath = newOrderDirPath.replace("new", "paid");
        const paidOrderFilePath = newOrderFilePath.replace("new", "paid");

        if (fs.existsSync(newOrderFilePath) && !fs.existsSync(paidOrderFilePath)) {

            let orderObject = JSON.parse(fs.readFileSync((newOrderFilePath), { flag: "r", encoding: "utf8" }));

            if (orderObject.order.txHash == null && orderObject.claimCounter == null) {

                orderObject.lastUpdate = Math.floor(Date.now() / 1000);

                orderObject.order.txHash = iTransactionHash;

                orderObject.order.claimCounter = 0;

                if (!fs.existsSync(paidOrderDirPath))
                    fs.mkdirSync(paidOrderDirPath, { recursive: true });

                fs.writeFileSync(paidOrderFilePath, JSON.stringify(orderObject), { flag: "w", encoding: "utf8" });
                fs.unlinkSync(newOrderFilePath);

                this.#pendingOrdersObject[paidOrderFilePath] = {};
                this.#pendingOrdersObject[paidOrderFilePath].triggerTimestamp = orderObject.lastUpdate;
                this.#pendingOrdersObject[paidOrderFilePath].triggerCount = 0;

                fs.writeFileSync(this.#pendingOrdersPath, JSON.stringify(this.#pendingOrdersObject), { flag: "w", encoding: "utf8" });

                return paidOrderFilePath;
            }
        }

        return false;
    }

    moveToFailed(iOrderFilePath) {

        const paidOrderFilePath = iOrderFilePath;
        const paidOrderDirPath = paidOrderFilePath.substr(0, paidOrderFilePath.lastIndexOf("/") + 1);

        const failedOrderFilePath = paidOrderFilePath.replace("paid", "failed");
        const failedOrderDirPath = paidOrderDirPath.replace("paid", "failed");

        if (fs.existsSync(paidOrderFilePath) && !fs.existsSync(failedOrderFilePath)) {

            const orderString = fs.readFileSync(paidOrderFilePath, { flag: "r", encoding: "utf8" });

            if (!fs.existsSync(failedOrderDirPath))
                fs.mkdirSync(failedOrderDirPath, { recursive: true });

            fs.writeFileSync(failedOrderFilePath, orderString, { flag: "w", encoding: "utf8" });
            fs.unlinkSync(paidOrderFilePath);

            return true;
        }

        return false;
    }

    moveToSuccessful(iOrderFilePath) {

        const paidOrderFilePath = iOrderFilePath;
        const paidOrderDirPath = paidOrderFilePath.substr(0, paidOrderFilePath.lastIndexOf("/") + 1);

        const successfulOrderFilePath = paidOrderFilePath.replace("paid", "successful");
        const successfulOrderDirPath = paidOrderDirPath.replace("paid", "successful");

        if (fs.existsSync(paidOrderFilePath) && !fs.existsSync(successfulOrderFilePath)) {

            const orderString = fs.readFileSync(paidOrderFilePath, { flag: "r", encoding: "utf8" });

            if (!fs.existsSync(successfulOrderDirPath))
                fs.mkdirSync(successfulOrderDirPath, { recursive: true });

            fs.writeFileSync(successfulOrderFilePath, orderString, { flag: "w", encoding: "utf8" });
            fs.unlinkSync(paidOrderFilePath);

            return true;
        }

        return false;
    }

    getTriggerObject(iOrderFilePath) {

        if (!fs.existsSync(iOrderFilePath)) {

            if (this.#pendingOrdersObject[iOrderFilePath] !== undefined)
                delete this.#pendingOrdersObject[iOrderFilePath];

            return false;
        }

        if (this.#pendingOrdersObject[iOrderFilePath] === undefined)
            return false;

        const orderObject = JSON.parse(fs.readFileSync((iOrderFilePath), { flag: "r", encoding: "utf8" }));

        let triggerObject = new Object();

        triggerObject.triggerTimestamp = this.#pendingOrdersObject[iOrderFilePath].triggerTimestamp;
        triggerObject.triggerCount = this.#pendingOrdersObject[iOrderFilePath].triggerCount;

        triggerObject.url = orderObject.order.postData.url;
        triggerObject.postData = this.#encryptData(iOrderFilePath, orderObject.order.receiver);
        triggerObject.claimed = orderObject.order.claimCounter;

        return triggerObject;
    }

    updatePendingList(iOrderFilePath) {

        if (this.#pendingOrdersObject[iOrderFilePath] === undefined)
            return false;

        this.#pendingOrdersObject[iOrderFilePath].triggerTimestamp = Math.floor(Date.now() / 1000);
        this.#pendingOrdersObject[iOrderFilePath].triggerCount++;

        fs.writeFileSync(this.#pendingOrdersPath, JSON.stringify(this.#pendingOrdersObject), { flag: "w", encoding: "utf8" });

        return true;
    }

    removeFromPendingList(iOrderFilePath) {

        if (this.#pendingOrdersObject[iOrderFilePath] === undefined)
            return false;

        delete this.#pendingOrdersObject[iOrderFilePath];

        fs.writeFileSync(this.#pendingOrdersPath, JSON.stringify(this.#pendingOrdersObject), { flag: "w", encoding: "utf8" });

        return true;
    }

    getPendingList() {

        return this.#pendingOrdersObject;
    }
}