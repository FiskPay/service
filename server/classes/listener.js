import Web3 from "web3";
import EventEmitter from "events";

export default class Listener extends EventEmitter {

    constructor() {

        super();
    }

    connect(network, parentAddress, providerURLs) {

        const options = { timeout: 1000, clientConfig: { keepalive: true, keepaliveInterval: 60000 } };
        const PARENT_ABI = [{ "inputs": [{ "internalType": "string", "name": "_name", "type": "string" }], "name": "GetContractAddress", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }];
        const PROCESSOR_ABI = [{ "anonymous": false, "inputs": [{ "indexed": true, "internalType": "bytes32", "name": "verification", "type": "bytes32" }, { "indexed": false, "internalType": "uint32", "name": "timestamp", "type": "uint32" }], "name": "Processed", "type": "event" }];

        class Providers {

            this = [];
        }

        const uRLCount = providerURLs.length;

        const reconnectAftenMilliseconds = 10000;
        let wasConnected = Array(uRLCount).fill(false);

        let connectedListeners = 0;

        let processorAddress = "0x0000000000000000000000000000000000000000";

        let nextTxIndex = 0;
        let txLoop = new Array(10);
        const txLoopLength = txLoop.length;

        const connect = (providerURL, providerIndex) => {

            Providers[providerIndex] = new Web3.providers.WebsocketProvider(providerURL, options);

            Providers[providerIndex].on("error", () => {
                reconnect(providerURL, providerIndex);
            }).on("close", () => {
                reconnect(providerURL, providerIndex);
            }).on("connect", () => {

                wasConnected[providerIndex] = true;

                const web3Instance = new Web3(Providers[providerIndex]);

                if (processorAddress == "0x0000000000000000000000000000000000000000") {

                    const parentContract = new web3Instance.eth.Contract(PARENT_ABI, parentAddress);

                    parentContract.methods.GetContractAddress(".Payment.Processor").call((error, address) => {

                        if (!error) {

                            if (address != "0x0000000000000000000000000000000000000000") {

                                processorAddress = address;
                                listen(web3Instance);
                            }
                        }
                    });
                }
                else
                    listen(web3Instance);
            });
        }

        const reconnect = (providerURL, providerIndex) => {

            if (wasConnected[providerIndex]) {

                wasConnected[providerIndex] = false;

                connectedListeners--;
                this.emit('connectionChange', network, connectedListeners);

                let pollingReconnection = setInterval(() => {

                    if (!wasConnected[providerIndex])
                        connect(providerURL, providerIndex);
                    else
                        clearInterval(pollingReconnection);
                }, reconnectAftenMilliseconds);
            }
        }

        const listen = (web3Instance) => {

            const processorContract = new web3Instance.eth.Contract(PROCESSOR_ABI, processorAddress);

            processorContract.events.Processed((error, data) => {

                if (!error) {

                    const transactionHash = data.transactionHash;
                    const verification = data.returnValues.verification;
                    const timestamp = data.returnValues.timestamp;

                    const tnow = Math.floor(Date.now() / 1000);
                    const expire = Number(timestamp) + 905;

                    if (expire >= tnow) {

                        let checkIndex;
                        let isNew = true;

                        for (let i = 0; i < txLoopLength; i++) {

                            checkIndex = nextTxIndex - 1 - i;

                            if (checkIndex < 0)
                                checkIndex = txLoopLength - 1 - i;

                            if (txLoop[checkIndex] === transactionHash) {

                                isNew = false;
                                i = txLoopLength;
                            }
                        }

                        if (isNew) {

                            txLoop[nextTxIndex] = transactionHash;

                            nextTxIndex++;

                            if (nextTxIndex >= txLoopLength)
                                nextTxIndex = 0;

                            this.emit('newTransaction', network, transactionHash, verification, timestamp);
                        }
                    }
                }
                else
                    console.log(error);
            });

            connectedListeners++;
            this.emit('listenerChange', network, connectedListeners);

        }

        for (let j = 0; j < providerURLs.length; j++)
            connect(providerURLs[j], j);
    }
}