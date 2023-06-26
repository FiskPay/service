import CryptoJS from "crypto-js";
import tiny from "tiny-json-http";
import fs from "fs";
import { isJson } from './isJson.js';
import { dateTime } from './dateTools.js';

export function post(_data) {

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

            saveToFile(fileName, jsonObject)
            console.log("[" + dateTime() + "] Postman >> PaymentLogger unreachable...");
        }
    });
}

export function repost() {

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

                        saveToFile(fileName, jsonObject)
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
            if (j.iv) cipherParams.iv = CryptoJS.enc.Hex.parse(j.iv)
            if (j.s) cipherParams.salt = CryptoJS.enc.Hex.parse(j.s)
            return cipherParams;
        }
    }

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