import CryptoJS from "crypto-js";
import dotenv from "dotenv";

export default class AES256 {

    #cryptoJSAesJson = {
        stringify: function (cipherParams) {
            let j = { ct: cipherParams.ciphertext.toString(CryptoJS.enc.Base64) };
            if (cipherParams.iv) j.iv = cipherParams.iv.toString();
            if (cipherParams.salt) j.s = cipherParams.salt.toString();
            return JSON.stringify(j);
        },
        parse: function (jsonStr) {
            let j = JSON.parse(jsonStr);
            let cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: CryptoJS.enc.Base64.parse(j.ct) });
            if (j.iv) cipherParams.iv = CryptoJS.enc.Hex.parse(j.iv)
            if (j.s) cipherParams.salt = CryptoJS.enc.Hex.parse(j.s)
            return cipherParams;
        }
    }

    #extraSeed = dotenv.config({ path: "M:/Workspaces/service/server/.env" }).parsed.extraAESSeed;

    encrypt(data, seed) {

        const key = CryptoJS.SHA256(seed + this.#extraSeed).toString();

        try {
            return CryptoJS.AES.encrypt(data, key, { format: this.#cryptoJSAesJson }).toString();
        }
        catch (e) {
            return false;
        }
    }

    decrypt(data, seed) {

        const key = CryptoJS.SHA256(seed + this.#extraSeed).toString();

        try {
            return CryptoJS.AES.decrypt(data, key, { format: this.#cryptoJSAesJson }).toString(CryptoJS.enc.Utf8);
        }
        catch (e) {
            return false;
        }
    }
}