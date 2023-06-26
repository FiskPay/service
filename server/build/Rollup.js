'use strict';

var Web3 = require('web3');
var EventEmitter = require('events');
var CryptoJS = require('crypto-js');
var tiny = require('tiny-json-http');
var fs = require('fs');

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

class Listener extends EventEmitter {

    constructor() {

        super();
    }

    connect = (network, parentAddress, providerURLs) => {

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

        const connect = (providerURL, providerIndex) => {

            Providers[providerIndex] = new Web3.providers.WebsocketProvider(providerURL, options);

            Providers[providerIndex].on("error", () => {
                reconnect(providerURL, providerIndex);
            }).on("close", () => {
                reconnect(providerURL, providerIndex);
            }).on("connect", () => {

                wasConnected[providerIndex] = true;

                connectedProviders++;
                console.log("[" + dateTime() + "] " + network + " >> Providers: " + connectedProviders + "/" + uRLCount + " Listeners: " + connectedListeners + "/" + uRLCount);

                let web3Instance = new Web3(Providers[providerIndex]);

                if (processorAddress == "0x0000000000000000000000000000000000000000") {

                    let parentContract = new web3Instance.eth.Contract(PARENT_ABI, parentAddress);

                    parentContract.methods.GetContractAddress(".Payment.Processor").call((error, address) => {

                        if (!error) {

                            if (address != "0x0000000000000000000000000000000000000000")
                                processorAddress = address;
                            else
                                console.log("[" + dateTime() + "] " + network + " >> ERROR: Processor address not set");

                            if (processorAddress !== undefined)
                                listen(web3Instance);
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
                console.log("[" + dateTime() + "] " + network + " >> Providers: " + connectedProviders + "/" + uRLCount + " Listeners: " + connectedListeners + "/" + uRLCount);

                connectedProviders--;
                connectedListeners--;

                if (connectedProviders < 0)
                    connectedProviders = 0;

                if (connectedListeners < 0)
                    connectedListeners = 0;

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

                    let checkIndex;
                    let isNew = true;

                    for (let i = 0; i < txLoop.length; i++) {

                        checkIndex = (nextTxIndex - 1 - i);

                        if (checkIndex < 0)
                            checkIndex = (txLoop.length - 1) - i;

                        if (txLoop[checkIndex] === transactionHash) {

                            isNew = false;
                            i = txLoop.length;
                        }
                    }

                    if (isNew) {

                        txLoop[nextTxIndex] = transactionHash;

                        nextTxIndex++;

                        if (nextTxIndex >= txLoop.length)
                            nextTxIndex = 0;

                        console.log("[" + dateTime() + "] " + network + " >> New transaction: " + transactionHash);
                        this.emit('transaction', [network, transactionHash, verification, timestamp]);
                    }
                }
                else
                    console.log(error);
            });

            connectedListeners++;
            console.log("[" + dateTime() + "] " + network + " >> Providers: " + connectedProviders + "/" + uRLCount + " Listeners: " + connectedListeners + "/" + uRLCount);

        };

        for (let j = 0; j < providerURLs.length; j++)
            connect(providerURLs[j], j);
    }
}

function isJson(_string) {

    try {
        JSON.parse(_string);
    } catch (e) {
        return false;
    }

    return true;
}

function post(_data) {

    var postURL = "https://api.fiskpay.com/log/";
    var fileDir = "./json/";

    var network = (_data[0].toLowerCase() == "mainnet") ? "polygon" : "mumbai";
    var fileName = network + "_not_posted_transactions.json";
    var filePath = fileDir + fileName;
    var jsonObject = JSON.parse("{ \"verification\": null, \"transactions\": [{ \"txHash\": \"" + _data[1] + "\", \"verification\": \"" + _data[2] + "\", \"timestamp\": \"" + _data[3] + "\" }]}");

    if (fs.existsSync(filePath)) {

        var oldJsonString = fs.readFileSync(filePath, "utf8");
        fs.unlinkSync(filePath);

        if (oldJsonString && isJson(oldJsonString)) {

            var oldJsonObject = JSON.parse(oldJsonString);
            var oldJsonLength = oldJsonObject.transactions.length;

            for (var i = 0; i < oldJsonLength; i++) {

                if (oldJsonObject.transactions[i].txHash != jsonObject.transactions[0].txHash)
                    jsonObject.transactions.push(oldJsonObject.transactions[i]);
            }
        }
    }

    jsonObject.verification = CryptoJS.SHA256(JSON.stringify(jsonObject.transactions)).toString();

    var jsonEncrypt = encrypt(JSON.stringify(jsonObject));
    var buffer = Buffer.from(jsonEncrypt, "binary");
    var jsonBase64 = buffer.toString("base64");
    var jsonData = JSON.parse("{ \"network\": \"" + network + "\", \"base64\": \"" + jsonBase64 + "\" }");

    tiny.post({ url: postURL, headers: { "Content-Type": "application/json", "Connection": "close" }, data: jsonData }, (error, result) => {

        if (!error && result.body == true)
            console.log("[" + dateTime() + "] Postman >> " + _data[0] + " transactions forwarded");
        else if (!error && result.body != true) {

            saveToFile(fileName, jsonObject);
            console.log("[" + dateTime() + "] Postman >> PaymentLogger blocked reposting...");
        }
        else {

            saveToFile(fileName, jsonObject);
            console.log("[" + dateTime() + "] Postman >> PaymentLogger unreachable...");
        }
    });
}

function repost() {

    var postURL = "https://api.fiskpay.com/log/";
    var fileDir = "./json/";
    var networks = ["polygon", "mumbai"];

    for (let network of networks) {

        var fileName = network.toLowerCase() + "_not_posted_transactions.json";
        var filePath = fileDir + fileName;

        if (fs.existsSync(filePath)) {

            var jsonString = fs.readFileSync(filePath, "utf8");
            fs.unlinkSync(filePath);

            if (jsonString && isJson(jsonString)) {

                var jsonObject = JSON.parse(jsonString);

                var jsonEncrypt = encrypt(jsonString);
                var buffer = Buffer.from(jsonEncrypt, "binary");
                var jsonBase64 = buffer.toString("base64");
                var jsonData = JSON.parse("{ \"network\": \"" + network + "\", \"base64\": \"" + jsonBase64 + "\" }");

                tiny.post({ url: postURL, headers: { "Content-Type": "application/json", "Connection": "close" }, data: jsonData }, (error, result) => {

                    if (!error && result.body == true)
                        console.log("[" + dateTime() + "] Postman >> " + _data[0] + " transactions forwarded");
                    else if (!error && result.body != true) {

                        saveToFile(fileName, jsonObject);
                        console.log("[" + dateTime() + "] Postman >> PaymentLogger blocked reposting...");
                    }
                    else {

                        saveToFile(fileName, jsonObject);
                        console.log("[" + dateTime() + "] Postman >> PaymentLogger unreachable...");
                    }
                });
            }
        }
    }
}

function encrypt(_jsonString) {

    var CryptoJSAesJson = {
        stringify: function (cipherParams) {
            var j = { ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64) };
            if (cipherParams.iv) j.iv = cipherParams.iv.toString();
            if (cipherParams.salt) j.s = cipherParams.salt.toString();
            return JSON.stringify(j);
        },
        parse: function (jsonStr) {
            var j = JSON.parse(jsonStr);
            var cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(j.ct) });
            if (j.iv) cipherParams.iv = CryptoJS.enc.Hex.parse(j.iv);
            if (j.s) cipherParams.salt = CryptoJS.enc.Hex.parse(j.s);
            return cipherParams;
        }
    };

    return (CryptoJS.AES.encrypt(_jsonString, "c*xcsHe0f25@^3cfJ!2f35**=", { format: CryptoJSAesJson }).toString());
}

function saveToFile(_fileName, _jsonObject) {

    var fileDir = "./json/";

    if (!fs.existsSync(fileDir))
        fs.mkdirSync(fileDir);

    var filePath = fileDir + _fileName;

    if (fs.existsSync(filePath)) {

        var newJsonString = fs.readFileSync(filePath, "utf8");
        fs.unlinkSync(filePath);

        if (newJsonString && isJson(newJsonString)) {

            var newJsonObject = JSON.parse(newJsonString);
            var newJsonLength = newJsonObject.transactions.length;

            for (var i = 0; i < newJsonLength; i++) {

                var found = false;

                for (var j = 0; j < _jsonObject.transactions.length; j++)
                    if (_jsonObject.transactions[j].txHash == newJsonObject.transactions[i].txHash) {

                        found = true;
                        break;
                    }

                if (found != true)
                    _jsonObject.transactions.push(newJsonObject.transactions[i]);
            }

            _jsonObject.verification = CryptoJS.SHA256(JSON.stringify(_jsonObject.transactions)).toString();

            fs.writeFileSync(filePath, JSON.stringify(_jsonObject), "utf8");
        }
        else
            fs.writeFileSync(filePath, JSON.stringify(_jsonObject), "utf8");
    }
    else
        fs.writeFileSync(filePath, JSON.stringify(_jsonObject), "utf8");
}

let mainnetProviderURLs = ["wss://summer-frequent-pallet.matic.discover.quiknode.pro/ff7be526a09ea124fb1458846c5902e89c0e8fc0", "wss://polygon-mainnet.g.alchemy.com/v2/aOiJ3FJj5g6EcSdK3VcPVwjakTkjxePv"];
let testnetProviderURLs = ["wss://ws-polygon-mumbai.chainstacklabs.com", "wss://polygon-mumbai.g.alchemy.com/v2/VckaBwf55LZXymGe0WBETzbp2rm1aZOC"];

const listener = new Listener();

listener.connect("Mainnet", "0x163342FAe2bBe3303e5A9ADCe4BC9fb44d0FF062", mainnetProviderURLs);
listener.connect("Testnet", "0xfc82AD7B08bC6AF0b0046ee8aE6b12df3457DE23", testnetProviderURLs);

listener.on('transaction', ([network, transactionHash, verification, timestamp]) => {

    post([network, transactionHash, verification, timestamp]);
});

setInterval(() => {

    repost();
}, 59999);
