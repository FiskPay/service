let script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/web3/1.10.0/web3.min.js";
script.type = "text/javascript";
script.setAttribute("crossorigin", 'anonymous');
script.integrity = "sha512-EXk1TBrT1TC+ajcr8c+McVhGFv4xAI+8m+V7T4PwT3MdYAv47jkirleTTZh8IFtRv90ZtKPOk/4JJTGUaQ9d6Q==";
script.defer = true;
document.head.appendChild(script);

const parentABI = [{ "inputs": [{ "internalType": "string", "name": "_name", "type": "string" }], "name": "GetContractAddress", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }];
const subscribersABI = [{ "inputs": [], "name": "GetDaysPerSeason", "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "GetSubscriptionCostPerDay", "outputs": [{ "internalType": "uint16", "name": "", "type": "uint16" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "GetSubscriptionsToReward", "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "GetTransactionsPerSeason", "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_client", "type": "address" }], "name": "Profile", "outputs": [{ "internalType": "address", "name": "referredBy", "type": "address" }, { "internalType": "uint32", "name": "referralCount", "type": "uint32" }, { "internalType": "uint256", "name": "referralEarnings", "type": "uint256" }, { "internalType": "uint32", "name": "transactionCount", "type": "uint32" }, { "internalType": "uint32", "name": "lastTransaction", "type": "uint32" }, { "internalType": "bool", "name": "isSubscriber", "type": "bool" }, { "internalType": "uint32", "name": "subscribedUntil", "type": "uint32" }, { "internalType": "uint32", "name": "subscribtionDaysLeft", "type": "uint32" }, { "internalType": "uint32", "name": "nextSeason", "type": "uint32" }, { "internalType": "uint32", "name": "seasonDaysLeft", "type": "uint32" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint32", "name": "_days", "type": "uint32" }, { "internalType": "address", "name": "_referrer", "type": "address" }], "name": "Subscribe", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "payable", "type": "function" }, { "stateMutability": "payable", "type": "receive" }];
const oracleABI = [{ "inputs": [], "name": "GetMATICDecimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }, { "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "GetMATICPrice", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }];

let updateInfoInterval, canSubscribe, referralAddress;

onload = () => {

    let urlParameters = new URLSearchParams(location.search);
    referralAddress = urlParameters.get('ref');

    if (Web3.utils.isAddress(referralAddress) == true)
        referralAddress = Web3.utils.toChecksumAddress(referralAddress);
    else
        referralAddress = "0x0000000000000000000000000000000000000000";

    document.getElementById('myProfile').addEventListener("click", (e) => {

        e.preventDefault();
        View();
    });

    canSubscribe = true;
}

async function View() {

    clearInterval(updateInfoInterval);

    async function updateProviderAndNetwork() {

        try {

            if (typeof (window.ethereum) !== "undefined" && window.ethereum != null)
                provider = window.ethereum;
            else if (typeof (window.web3.currentProvider) !== "undefined" && window.ethereum.currentProvider != null)
                provider = window.web3.currentProvider;

            if (provider !== null) {

                try {

                    network = await provider.request({ method: 'eth_chainId' });

                    if (network != 0x13881 && network != 0x89)
                        await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] }); //Polygon Mainnet
                }
                catch (switchError) {

                    if (switchError.code === 4902) {

                        try {

                            await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0x89', blockExplorerUrls: ['https://polygonscan.com/'], chainName: 'Polygon Mainnet', nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18, }, rpcUrls: ['https://polygon-rpc.com/'], }] });
                            await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x89' }] }); //Polygon Mainnet
                        }
                        catch (e) {
                            //ignore the error
                        }
                    }
                }
                finally {

                    if (network != 0x13881 && network != 0x89)
                        network = await provider.request({ method: 'eth_chainId' });
                }
            }

        } catch (e) {

            //console.log(e);
        }
    }

    async function updateClientAddress() {

        try {

            let fetchedAddresses = await provider.request({ method: 'eth_requestAccounts' });

            clientAddress = Web3.utils.toChecksumAddress(fetchedAddresses[0]);
        }
        catch (e) {

            //console.log(e);
        }
    }

    async function updateContracts() {

        web3Instance = new Web3(provider);
        web3Instance.eth.transactionBlockTimeout = 12000;
        web3Instance.eth.transactionPollingTimeout = 400000;

        let parentAddress;

        if (network == 0x89)                    //Polygon
            parentAddress = "0x163342FAe2bBe3303e5A9ADCe4BC9fb44d0FF062";
        else                                    //Mumbai
            parentAddress = "0xfc82AD7B08bC6AF0b0046ee8aE6b12df3457DE23";

        try {

            let parentContract = new web3Instance.eth.Contract(parentABI, parentAddress);

            let subscribersAddress = parentContract.methods.GetContractAddress(".Payment.Subscribers").call({ from: clientAddress });
            let oracleAddress = parentContract.methods.GetContractAddress(".Corporation.Oracle").call({ from: clientAddress });

            let resolvedData = await Promise.all([subscribersAddress, oracleAddress]);

            subscribersContract = new web3Instance.eth.Contract(subscribersABI, resolvedData[0]);
            oracleContract = new web3Instance.eth.Contract(oracleABI, resolvedData[1]);
        }
        catch (e) {

            //console.log(e);
        }
    }

    async function updateInfo() {

        try {

            let subscriptionCostPerDay = subscribersContract.methods.GetSubscriptionCostPerDay().call({ from: clientAddress });
            let subscriptionsToReward = subscribersContract.methods.GetSubscriptionsToReward().call({ from: clientAddress });
            let transactionsPerSeason = subscribersContract.methods.GetTransactionsPerSeason().call({ from: clientAddress });
            let daysPerSeason = subscribersContract.methods.GetDaysPerSeason().call({ from: clientAddress });

            let profile = subscribersContract.methods.Profile(clientAddress).call({ from: clientAddress });

            let maticPrice = oracleContract.methods.GetMATICPrice().call({ from: clientAddress });
            let maticDecimals = oracleContract.methods.GetMATICDecimals().call({ from: clientAddress });

            let resolvedData = await Promise.all([subscriptionCostPerDay, subscriptionsToReward, transactionsPerSeason, daysPerSeason, profile, maticPrice, maticDecimals]);

            subscriptionCost = resolvedData[0];
            subscriptionToReward = resolvedData[1];
            seasonTransactions = resolvedData[2];
            seasonDays = resolvedData[3];

            clientReferredBy = resolvedData[4][0];
            clientReferralCount = resolvedData[4][1];
            clientReferralEarnings = resolvedData[4][2];
            clientTransactionCount = resolvedData[4][3];
            clientLastTransaction = resolvedData[4][4];
            clientIsSubscriber = resolvedData[4][5];
            clientSubscribedUntil = resolvedData[4][6];
            clientSubscribtionDaysLeft = resolvedData[4][7];
            clientNextSeason = resolvedData[4][8];
            clientSeasonDaysLeft = resolvedData[4][9];

            maticDivident = resolvedData[5];
            maticDemicals = resolvedData[6][0];
            maticUpdated = resolvedData[6][1];
        }
        catch (e) {

            //console.log(e);
        }
    }

    function updateProfile() {

        function getDateTime(_timestamp) {

            if (_timestamp == 0)
                return "Date unavailable";

            //let tsDate = new Date(timestamp * 1000 - ((new Date()).getTimezoneOffset() * 60000));
            let tsDate = new Date(_timestamp * 1000);

            let dateTime = ((tsDate.getDate() > 9) ? (tsDate.getDate()) : ("0" + tsDate.getDate())) + "/"
                + ((tsDate.getMonth() > 8) ? (tsDate.getMonth() + 1) : ("0" + (tsDate.getMonth() + 1))) + "/"
                + (tsDate.getFullYear()) + " @ "
                + ((tsDate.getHours() > 9) ? (tsDate.getHours()) : ("0" + tsDate.getHours())) + ":"
                + ((tsDate.getMinutes() > 9) ? (tsDate.getMinutes()) : ("0" + tsDate.getMinutes())) + ":"
                + ((tsDate.getSeconds() > 9) ? (tsDate.getSeconds()) : ("0" + tsDate.getSeconds()));

            return dateTime;
        }

        let maticValueFloat = (maticUpdated) ? (parseFloat(maticDivident) / Math.pow(10, maticDemicals)) : (0);
        let subscriptionCostFloat = (parseFloat(subscriptionCost) / 100).toFixed(2);

        let clientReferralEarningsFloat = String(clientReferralEarnings);

        while (clientReferralEarningsFloat.length < 18)
            clientReferralEarningsFloat = "0" + clientReferralEarningsFloat;

        clientReferralEarningsFloat = parseFloat(clientReferralEarningsFloat.slice(0, clientReferralEarningsFloat.length - 18) + "." + clientReferralEarningsFloat.slice(clientReferralEarningsFloat.length - 18)).toFixed(6);

        let subscriptionCostInUSD = subscriptionCostFloat + " <b>&#36;</b>";
        let referalProgress = clientReferralCount + "/" + subscriptionToReward;
        let referalEarningsInMatic = clientReferralEarningsFloat + " MATIC";
        let transactionsLeft = (clientIsSubscriber) ? ("<b>&#8734;</b>/" + seasonTransactions) : (seasonTransactions - clientTransactionCount + "/" + seasonTransactions);
        let latestTransactionDate = getDateTime(clientLastTransaction);
        let subscriptionExpireDate = getDateTime(clientSubscribedUntil);
        let nextSeasonDate = getDateTime(clientNextSeason);
        let seasonProgress = seasonDays - clientSeasonDaysLeft + "/" + seasonDays;
        let maticValueInUSD = maticValueFloat.toFixed(2) + " <b>&#36;</b>";

        document.getElementById("subscriptionCostInUSD").innerHTML = subscriptionCostInUSD;
        document.getElementById("clientAddress").innerHTML = clientAddress;
        document.getElementById("clientReferredBy").innerHTML = clientReferredBy;
        document.getElementById("referalProgress").innerHTML = referalProgress;
        document.getElementById("referalEarningsInMatic").innerHTML = referalEarningsInMatic;
        document.getElementById("transactionsLeft").innerHTML = transactionsLeft;
        document.getElementById("latestTransactionDate").innerHTML = latestTransactionDate;
        document.getElementById("clientSubscribtionDaysLeft").innerHTML = clientSubscribtionDaysLeft;
        document.getElementById("subscriptionExpireDate").innerHTML = subscriptionExpireDate;
        document.getElementById("seasonProgress").innerHTML = seasonProgress;
        document.getElementById("nextSeasonDate").innerHTML = nextSeasonDate;
        document.getElementById("maticValueInUSD").innerHTML = maticValueInUSD;
    }

    function updateMaticPerDay() {

        let maticValueFloat = (maticUpdated) ? (parseFloat(maticDivident) * 0.99 / Math.pow(10, maticDemicals)) : (0);
        let subscriptionCostFloat = (parseFloat(subscriptionCost) / 100).toFixed(2);

        let maticPerDayFloat = String(subscriptionCostFloat / maticValueFloat);

        let dotPosition = maticPerDayFloat.indexOf('.');
        let integerPart = maticPerDayFloat.slice(0, dotPosition);
        let decimalPart = maticPerDayFloat.slice(dotPosition + 1);

        while (decimalPart.length < 18)
            decimalPart = decimalPart + "0";

        if (Number(integerPart) > 0)
            maticPerDay = integerPart + decimalPart
        else
            maticPerDay = decimalPart;
    }

    function sendMessage(_msg) {

        document.getElementById("message").innerHTML = _msg;
    }

    let subscribe = () => {

        if (canSubscribe === true) {

            canSubscribe = false;

            let days = document.getElementById("days").value;

            if (((/^[0-9]*$/).test(days.toString())) && Number(days) <= 365) {

                let maticToPay = String(BigInt(maticPerDay) * BigInt(days));

                web3Instance.eth.getBalance(clientAddress)
                    .then((balance) => {

                        if (BigInt(balance) >= BigInt(maticToPay)) {

                            web3Instance.eth.getGasPrice()
                                .then((gas) => {

                                    subscribersContract.methods.Subscribe(days, referralAddress).send({ from: clientAddress, value: maticToPay, gasPrice: gas })
                                        .on("sent", () => {

                                            let wallet = "web3 wallet";

                                            if (provider.isMetaMask === true)
                                                wallet = "MetaMask";
                                            else if (provider.isBraveWallet === true)
                                                wallet = "Brave Wallet";
                                            else if (provider.isTrustWallet === true)
                                                wallet = "Trust Wallet";

                                            sendMessage("Forwarding payment to " + wallet);
                                        })
                                        .on("transactionHash", async (txHash) => {

                                            sendMessage("Payment submitted to blockchain");

                                            web3Instance.eth.getTransactionCount(clientAddress)
                                                .then((startingNonce) => {

                                                    let pollingTransaction = setInterval(() => {

                                                        web3Instance.eth.getTransaction(txHash)
                                                            .then((transaction) => {

                                                                if (transaction != null) {

                                                                    web3Instance.eth.getTransactionReceipt(txHash)
                                                                        .then((receipt) => {

                                                                            if (receipt != null && receipt.status == true) {

                                                                                clearInterval(pollingTransaction);

                                                                                sendMessage("Payment was successful");
                                                                                setTimeout(() => { canSubscribe = true; }, 1000);
                                                                            }
                                                                        });
                                                                }
                                                                else {

                                                                    clearInterval(pollingTransaction);

                                                                    sendMessage("Action submitted to the blockchain");

                                                                    let pollingNonce = setInterval(() => {

                                                                        web3Instance.eth.getTransactionCount(clientAddress).then((currentNonce) => {

                                                                            if (currentNonce != startingNonce) {

                                                                                clearInterval(pollingNonce);

                                                                                sendMessage("Action was successful");
                                                                                setTimeout(() => { canSubscribe = true; }, 1000);

                                                                            }
                                                                        });
                                                                    }, 1500);
                                                                }

                                                            });
                                                    }, 1500);
                                                });
                                        })
                                        .on("error", () => {

                                            sendMessage("Payment has been canceled");
                                            setTimeout(() => { canSubscribe = true; }, 1000);
                                        });
                                });
                        }
                        else {
                            sendMessage("Insufficient balance");
                            setTimeout(() => { canSubscribe = true; }, 1000);
                        }
                    });
            }
            else
                canSubscribe = true;
        }
    }

    let provider, network, clientAddress, web3Instance, subscribersContract, oracleContract;
    let maticPerDay, subscriptionCost, subscriptionToReward, seasonTransactions, seasonDays;
    let clientReferredBy, clientReferralCount, clientReferralEarnings, clientTransactionCount, clientLastTransaction, clientIsSubscriber, clientSubscribedUntil, clientSubscribtionDaysLeft, clientNextSeason, clientSeasonDaysLeft;
    let maticDivident, maticDemicals, maticUpdated;

    await updateProviderAndNetwork();

    if (typeof (provider) != "undefined" && typeof (network != "undefined")) {

        if (network == 0x13881 || network == 0x89) {

            await updateClientAddress();

            if (typeof (clientAddress) != "undefined") {

                await updateContracts();
                await updateInfo();

                updateMaticPerDay();
                updateProfile();

                updateInfoInterval = setInterval(async () => {

                    await updateInfo();

                    updateMaticPerDay();
                    updateProfile();

                }, 10000);

                document.getElementById("subscribe").addEventListener('click', subscribe);
            }

            provider.on('accountsChanged', () => {

                document.getElementById("subscribe").removeEventListener('click', subscribe);
                View();
            }).on('chainChanged', () => {

                document.getElementById("subscribe").removeEventListener('click', subscribe);
                View();
            });
        }
        else
            console.log("Wrong network");
    }
}