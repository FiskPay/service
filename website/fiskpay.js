let script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/web3/1.10.0/web3.min.js";
script.type = "text/javascript";
script.setAttribute("crossorigin", 'anonymous');
script.integrity = "sha512-EXk1TBrT1TC+ajcr8c+McVhGFv4xAI+8m+V7T4PwT3MdYAv47jkirleTTZh8IFtRv90ZtKPOk/4JJTGUaQ9d6Q==";
script.defer = true;
document.head.appendChild(script);

script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/js-sha256/0.9.0/sha256.min.js";
script.type = "text/javascript";
script.setAttribute("crossorigin", 'anonymous');
script.integrity = "sha512-szJ5FSo9hEmXXe7b5AUVtn/WnL8a5VofnFeYC2i2z03uS2LhAch7ewNLbl5flsEmTTimMN0enBZg/3sQ+YOSzQ==";
script.defer = true;
document.head.appendChild(script);

const url = new URL(document.currentScript.src);
const urlParameters = new URLSearchParams(url.search);

let receiverAddress = null;
let canProcess = false;
let antiBotTimer = 999999999999999;
let buttonIDList = new Array();
let buttonIDListCount = 0;

onload = () => {

	const paymentButtons = document.getElementsByClassName("fiskpay");
	let seed = Date.now() + 51312645;

	for (let i = 0; i < paymentButtons.length; i++) {

		const paymentButton = paymentButtons[i];

		paymentButton.id = "fp-" + sha256(seed.toString() + "!!@xXx");
		buttonIDList.push(paymentButton.id);

		const fpresponse = paymentButton.querySelectorAll('[name="fp-response"]');
		const fpfiat = paymentButton.querySelectorAll('[name="fp-fiat"]');
		const fpcrypto = paymentButton.querySelectorAll('[name="fp-crypto"]');
		const fpamount = paymentButton.querySelectorAll('[name="fp-amount"]');
		const fpurl = paymentButton.querySelectorAll('[name="fp-url"]');
		const fpitem1 = paymentButton.querySelectorAll('[name="fp-item1"]');
		const fpitem2 = paymentButton.querySelectorAll('[name="fp-item2"]');
		const fpitem3 = paymentButton.querySelectorAll('[name="fp-item3"]');
		const fpitem4 = paymentButton.querySelectorAll('[name="fp-item4"]');
		const fpsubmit = paymentButton.querySelectorAll('[name="fp-submit"]');

		const findArray = [fpresponse, fpfiat, fpcrypto, fpamount, fpurl, fpitem1, fpitem2, fpitem3, fpitem4, fpsubmit];
		const namesArray = ["fp-response", "fp-fiat", "fp-crypto", "fp-amount", "fp-url", "fp-item1", "fp-item2", "fp-item3", "fp-item4", "fp-submit"];

		let misconfigured = false;
		let consoleMsg = "";

		for (let j = 0; j < findArray.length; j++) {

			if (findArray[j].length != 1) {

				misconfigured = true;

				if (findArray[j].length == 0)
					consoleMsg += 'item <... name="' + namesArray[j] + '" ...> not found\n';
				else
					consoleMsg += 'multiple instances of item <... name="' + namesArray[j] + '" ...>\n';
			}
		}

		if (misconfigured == true) {

			alert("FiskPay button misconfigured. Button identifier:\n" + paymentButton.id + "\nClose this alert box and check your browser console, for more information.");
			console.log("----------------------------------------------------------------------------------------------------------\n\nButton " + paymentButton.id + " configuration errors:\n\n" + consoleMsg + "\n----------------------------------------------------------------------------------------------------------\n");
		}
		else {

			fpresponse[0].innerHTML = "FiskPay Checkout";

			if (fpsubmit[0].classList.contains("fiskpay-pay")) {

				fpsubmit[0].innerHTML = "&#10148;";
				fpsubmit[0].style.display = "inline-block";
			}

			fpsubmit[0].addEventListener("click", (e) => {

				e.preventDefault();
				Pay(paymentButton.id);
			});

			paymentButton.addEventListener("submit", (e) => {

				e.preventDefault();
				Pay(paymentButton.id);
			});
		}

		seed++;
	};

	buttonIDListCount = buttonIDList.length;
	receiverAddress = url.pathname.split('/')[1];
	//receiverAddress = urlParameters.get("addr");

	if (receiverAddress == null)
		alert("Receiver address is not set. Insert your wallet address in the url, to continue.");
	else if (Web3.utils.isAddress(receiverAddress) != true)
		alert("Receiver address is not an Ethereum address. Insert a proper address in the url, to continue.");
	else {

		receiverAddress = Web3.utils.toChecksumAddress(receiverAddress);
		canProcess = true;
	}

	antiBotTimer = Date.now();
}

async function Pay(_buttonID) {

	if (antiBotTimer + 400 > Date.now())
		canProcess = false;

	if (buttonIDList.includes(_buttonID) == false || buttonIDListCount != buttonIDList.length)
		canProcess = false;

	if (canProcess == true) {

		canProcess = false;

		try {

			let senderCurrentAddress = null;
			let senderAddressesArray = null;
			let provider = null;

			if (typeof (window.ethereum) !== "undefined" && window.ethereum != null)
				provider = window.ethereum;
			else if (typeof (window.web3) !== "undefined" && typeof (window.web3.currentProvider) !== "undefined" && window.web3.currentProvider != null)
				provider = window.web3.currentProvider;

			const paymentButton = document.getElementById(_buttonID);
			let response = paymentButton.querySelectorAll('[name="fp-response"]')[0];

			function sendMessage(_msg) { response.innerHTML = _msg; }

			if (provider !== null) {

				let network = null;

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
						catch (err) { }
					}
				}
				finally {

					if (network != 0x13881 && network != 0x89)
						network = await provider.request({ method: 'eth_chainId' });
				}

				if (network == 0x13881 || network == 0x89) {

					senderAddressesArray = await provider.request({ method: 'eth_requestAccounts' });
					senderCurrentAddress = Web3.utils.toChecksumAddress(senderAddressesArray[0]);

					provider.on('accountsChanged', (accounts) => {

						senderAddressesArray = accounts;

						if (senderAddressesArray.length == 0)
							senderCurrentAddress = null;
						else if (senderAddressesArray != null)
							senderCurrentAddress = Web3.utils.toChecksumAddress(accounts[0]);
					});

					provider.on('chainChanged', () => {

						return false;
						//window.location.reload();
					});

					const parentABI = [{ "inputs": [{ "internalType": "string", "name": "_name", "type": "string" }], "name": "GetContractAddress", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }];
					const processorABI = [{ "inputs": [{ "internalType": "string", "name": "_symbol", "type": "string" }, { "internalType": "uint256", "name": "_amount", "type": "uint256" }, { "internalType": "address", "name": "_receiver", "type": "address" }, { "internalType": "bytes32", "name": "_verification", "type": "bytes32" }, { "internalType": "uint32", "name": "_timestamp", "type": "uint32" }], "name": "Process", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "payable", "type": "function" }];
					const currenciesABI = [{ "inputs": [{ "internalType": "string", "name": "_symbol", "type": "string" }], "name": "GetCurrencyAddress", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }];
					const subscribersABI = [{ "inputs": [], "name": "GetTransactionsPerSeason", "outputs": [{ "internalType": "uint32", "name": "", "type": "uint32" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "_client", "type": "address" }], "name": "Profile", "outputs": [{ "internalType": "address", "name": "referredBy", "type": "address" }, { "internalType": "uint32", "name": "referralCount", "type": "uint32" }, { "internalType": "uint256", "name": "referralEarnings", "type": "uint256" }, { "internalType": "uint32", "name": "transactionCount", "type": "uint32" }, { "internalType": "uint32", "name": "lastTransaction", "type": "uint32" }, { "internalType": "bool", "name": "isSubscriber", "type": "bool" }, { "internalType": "uint32", "name": "subscribedUntil", "type": "uint32" }, { "internalType": "uint32", "name": "subscribtionDaysLeft", "type": "uint32" }, { "internalType": "uint32", "name": "nextSeason", "type": "uint32" }, { "internalType": "uint32", "name": "seasonDaysLeft", "type": "uint32" }], "stateMutability": "view", "type": "function" }];
					const cryptoABI = [{ "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }, { "name": "_spender", "type": "address" }], "name": "allowance", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }];

					const web3Instance = new Web3(provider);
					web3Instance.eth.transactionBlockTimeout = 12000;
					web3Instance.eth.transactionPollingTimeout = 400000;
					web3Instance.eth.transactionPollingInterval = 1000;

					let parentAddress;

					if (network == 0x89)                    //Polygon
						parentAddress = "0x163342FAe2bBe3303e5A9ADCe4BC9fb44d0FF062";
					else                                    //Mumbai
						parentAddress = "0xfc82AD7B08bC6AF0b0046ee8aE6b12df3457DE23";

					const parentContract = await new web3Instance.eth.Contract(parentABI, parentAddress);

					const processorAddress = await parentContract.methods.GetContractAddress(".Payment.Processor").call({ from: senderCurrentAddress });
					const processorContract = await new web3Instance.eth.Contract(processorABI, processorAddress);

					const currenciesAddress = await parentContract.methods.GetContractAddress(".Payment.Currencies").call({ from: senderCurrentAddress });
					const currenciesContract = await new web3Instance.eth.Contract(currenciesABI, currenciesAddress);

					const subscribersAddress = await parentContract.methods.GetContractAddress(".Payment.Subscribers").call({ from: senderCurrentAddress });
					const subscribersContract = await new web3Instance.eth.Contract(subscribersABI, subscribersAddress);

					let fiatSymbol = paymentButton.querySelectorAll('[name="fp-fiat"]')[0].value;
					let cryptoSymbol = paymentButton.querySelectorAll('[name="fp-crypto"]')[0].value;
					const inputAmount = paymentButton.querySelectorAll('[name="fp-amount"]')[0].value;

					const postURL = paymentButton.querySelectorAll('[name="fp-url"]')[0].value;
					const postItem1 = paymentButton.querySelectorAll('[name="fp-item1"]')[0].value;
					const postItem2 = paymentButton.querySelectorAll('[name="fp-item2"]')[0].value;
					const postItem3 = paymentButton.querySelectorAll('[name="fp-item3"]')[0].value;
					const postItem4 = paymentButton.querySelectorAll('[name="fp-item4"]')[0].value;

					if (cryptoSymbol.toLowerCase() == "matic")
						cryptoSymbol = "MATIC";

					if (fiatSymbol.toLowerCase() == "crypto")
						fiatSymbol = "crypto";

					const cryptoAddress = await currenciesContract.methods.GetCurrencyAddress(cryptoSymbol).call({ from: senderCurrentAddress });

					if (((cryptoAddress == "0x0000000000000000000000000000000000000000" && network == 0x89) || network == 0x13881) && cryptoSymbol != "MATIC") {

						sendMessage(cryptoSymbol + " is not supported");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else if (!((/^[a-zA-Z]{3}$/).test(fiatSymbol) || fiatSymbol == "crypto")) {

						sendMessage("Unaccepted fiat symbol");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else if (inputAmount.toString() == "") {

						sendMessage("Insert amount");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else if (!((/^[0-9]+(\.[0-9]+)?$/).test(inputAmount.toString()))) {

						sendMessage("Unaccepted amount format");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else if (inputAmount == 0) {

						sendMessage("Amount is zero");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else if (!(/^https?:\/\/(((www\.)?([a-zA-Z]+\-?[a-zA-Z]+\.)+[a-zA-Z]{2,7})|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))((:6553[0-5]|:655[0-2][0-9]|:65[0-4][0-9]{2}|:6[0-4][0-9]{3}|:[1-5][0-9]{4}|:[0-5]{0,5}|:[0-9]{1,4}))?([a-zA-Z0-9_\-\/])*(\.[a-zA-Z]{1,5})?/).test(postURL)) {

						sendMessage("Unaccepted postURL");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else if ((/exec\((.*)\)/).test(postItem1)) {

						sendMessage("Unaccepted postItem1");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else if ((/exec\((.*)\)/).test(postItem2)) {

						sendMessage("Unaccepted postItem2");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else if ((/exec\((.*)\)/).test(postItem3)) {

						sendMessage("Unaccepted postItem3");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else if ((/exec\((.*)\)/).test(postItem4)) {

						sendMessage("Unaccepted postItem4");
						setTimeout(() => { canProcess = true; }, 1000);
					}
					else {

						const profileObject = await subscribersContract.methods.Profile(receiverAddress).call({ from: senderCurrentAddress });
						const transactionsPerSeason = await subscribersContract.methods.GetTransactionsPerSeason().call({ from: senderCurrentAddress });
						const tnow = Math.floor(Date.now() / 1000);

						if (cryptoSymbol == "MATIC" && tnow > Number(profileObject.subscribedUntil) && Number(profileObject.transactionCount) >= Number(transactionsPerSeason)) {

							sendMessage("Transaction limit reached");
							setTimeout(() => { canProcess = true; }, 1000);
						}
						else if (cryptoSymbol != "MATIC" && tnow > Number(profileObject.subscribedUntil)) {

							sendMessage("Subscriber service only");
							setTimeout(() => { canProcess = true; }, 1000);
						}
						else {

							const sendObject = {

								"network": network,
								"senderAddress": senderCurrentAddress,
								"receiverAddress": receiverAddress,
								"cryptoSymbol": cryptoSymbol,
								"fiatSymbol": fiatSymbol,
								"amount": inputAmount,
								"postURL": postURL,
								"postItem1": postItem1,
								"postItem2": postItem2,
								"postItem3": postItem3,
								"postItem4": postItem4
							};

							const url = "https://app.fiskpay.com/createOrder";
							const sendString = JSON.stringify(sendObject);

							const http = new XMLHttpRequest();

							http.onerror = () => {

								sendMessage("Service unavailable");
								setTimeout(() => { canProcess = true; }, 1000);
							};

							http.onloadstart = () => {

								sendMessage("Fetching blockchain data");
							};

							http.onloadend = async () => {

								if (http.readyState === 4 && http.status === 200) {

									const responseString = http.response;
									let responseObject = null;

									try { responseObject = JSON.parse(responseString); }
									catch (e) {
										//console.log(e);
									}

									if (responseObject !== null) {

										if (responseObject.error !== false) {

											sendMessage(responseObject.message);
											setTimeout(() => { canProcess = true; }, 1000);
										}
										else {

											function process(_cryptoSymbol, _processAmount, _processVerification, _processTimestamp) {

												let expiredFail = setTimeout(async () => {

													sendMessage("Transaction will fail / expired");
												}, 900000 - (Math.floor(Date.now() / 1000) - Number(_processTimestamp)));

												let amount = "0";
												let value = "0";

												if (_cryptoSymbol == "MATIC")
													value = _processAmount;
												else
													amount = _processAmount;

												web3Instance.eth.getGasPrice()
													.then((gas) => {

														processorContract.methods.Process(_cryptoSymbol, amount, receiverAddress, _processVerification, _processTimestamp).send({ from: senderCurrentAddress, value: value, gasPrice: gas })
															.on("sent", () => {

																let wallet = "Web3 wallet";

																if (provider.isMetaMask === true)
																	wallet = "Brave Wallet";
																else if (provider.isBraveWallet === true)
																	wallet = "Brave Wallet";
																else if (provider.isTrustWallet === true)
																	wallet = "Trust Wallet";

																sendMessage("Sign transaction on " + wallet);
															})
															.on("transactionHash", (txHash) => {

																clearTimeout(expiredFail);

																startPolling(txHash);
																sendMessage("Transaction submitted to blockchain");
															})
															.on("error", () => {

																if (Math.floor(Date.now() / 1000) - Number(_processTimestamp) >= 900)
																	sendMessage("Transaction failed / expired");
																else
																	sendMessage("Transaction canceled");

																setTimeout(() => { canProcess = true; }, 1000);
															});
													});

												async function startPolling(_txHash) {

													let nonce = await web3Instance.eth.getTransactionCount(senderCurrentAddress);
													let pollingTransaction = setInterval(async () => {

														let transaction = await web3Instance.eth.getTransaction(_txHash);

														if (transaction != null) {

															let receipt = await web3Instance.eth.getTransactionReceipt(_txHash);

															if (receipt != null && receipt.status == true) {

																clearInterval(pollingTransaction);

																sendMessage("Payment was successful");
																setTimeout(() => { canProcess = true; }, 1000);
															}
														}
														else {

															clearInterval(pollingTransaction);

															sendMessage("Action submitted to the blockchain");

															let pollingNonce = setInterval(async () => {

																let latestCount = await web3Instance.eth.getTransactionCount(senderCurrentAddress);

																if (nonce != latestCount) {

																	clearInterval(pollingNonce);

																	sendMessage("Action was successful");
																	setTimeout(() => { canProcess = true; }, 1000);
																}
															}, 1500);
														}
													}, 1500);
												}
											}

											const processAmount = responseObject.data.amount;
											const processVerification = responseObject.data.verification;
											const processTimestamp = responseObject.data.timestamp;

											if (cryptoSymbol == "MATIC") {

												web3Instance.eth.getBalance(senderCurrentAddress)
													.then((balance) => {

														if (BigInt(balance) >= BigInt(processAmount) && BigInt(processAmount) > BigInt(0))
															process("MATIC", processAmount, processVerification, processTimestamp);
														else {

															sendMessage("Insufficient MATIC balance");
															setTimeout(() => { canProcess = true; }, 1000);
														}
													});
											}
											else {

												const cryptoContract = await new web3Instance.eth.Contract(cryptoABI, cryptoAddress);

												cryptoContract.methods.balanceOf(senderCurrentAddress).call({ from: senderCurrentAddress })
													.then((balance) => {

														if (BigInt(balance) >= BigInt(processAmount) && BigInt(processAmount) > BigInt(0)) {

															cryptoContract.methods.allowance(senderCurrentAddress, processorAddress).call({ from: senderCurrentAddress })
																.then((allowance) => {

																	if (BigInt(allowance) < BigInt(processAmount)) {

																		web3Instance.eth.getGasPrice()
																			.then((gas) => {

																				cryptoContract.methods.approve(processorAddress, processAmount).send({ from: senderCurrentAddress, gasPrice: gas })
																					.on("sent", () => {

																						let wallet = "Web3 wallet";

																						if (provider.isMetaMask === true)
																							wallet = "MetaMask";
																						else if (provider.isBraveWallet === true)
																							wallet = "Brave Wallet";
																						else if (provider.isTrustWallet === true)
																							wallet = "Trust Wallet";

																						sendMessage("Sign approval on " + wallet);
																					})
																					.on("error", () => {

																						sendMessage("Approval has been canceled");
																						setTimeout(() => { canProcess = true; }, 1000);
																					})
																					.on("receipt", async () => {
																						process(cryptoSymbol, processAmount, processVerification, processTimestamp);
																					});
																			});
																	}
																	else
																		process(cryptoSymbol, processAmount, processVerification, processTimestamp);
																});
														}
														else {

															sendMessage("Insufficient " + cryptoSymbol + " balance");
															setTimeout(() => { canProcess = true; }, 1000);
														}
													});
											}
										}
									}
									else {

										sendMessage("Response is not a JSON");
										setTimeout(() => { canProcess = true; }, 1000);
									}
								}
							};

							http.open("POST", url, true);
							http.setRequestHeader("Content-type", "application/json");
							http.send(sendString);
						}
					}
				}
				else {

					sendMessage("Wrong network");
					setTimeout(() => { canProcess = true; }, 1000);
				}
			}
			else {

				sendMessage("No blockchain connection");
				setTimeout(() => { canProcess = true; }, 1000);
			}
		}
		catch (e) {
			console.log(e);
		}
	}
}

let style = document.createElement("style");
style.innerHTML = (`
	
		/* Structure */	
		.fiskpay.form{
			
			border-radius: 12px;
			width: 215px;
			padding: 10px 17px 13px 17px;
		}
		
		.fiskpay.no-border{
			
			border:0 !important;
		}
		
		.fiskpay.sharp-border{
			
			border-radius:0 !important;
		}
	
		.fiskpay .fiskpay-messager{
			
			display: block;
			width: 100%;
			font-size: 14px;	
			font-style: italic;
			text-align:center;
			margin-bottom: 8px;
			margin-left: auto;
			margin-right:auto;
			height:17px;
			border-radius: 10px;
		}
		
		.fiskpay .fiskpay-pay{
			
			display: none;
			cursor: pointer;
			padding: 0px 3px 1px 5px;
			border-radius: 4px;
			font-size:14px;
		}
		
		.fiskpay .fiskpay-label{
			
			display: inline-block;
			font-size: 18px;
			width: 85px;
			margin-bottom:2px;
		}
		
		.fiskpay .fiskpay-input{
			
			display: inline-block;
			font-size: 14px;
			width: 93px;
			border: 1px solid;
			border-radius: 4px;
			padding-left: 3px;
		}
		
		.fiskpay .fiskpay-select{
			
			display: inline-block;
			font-size: 14px;
			width: 100px;
			border: 1px solid;
			border-radius: 4px;
			
		}	
			
		.fiskpay .fiskpay-select option{
			font-size: inherit;
			background-color: inherit;
		}
	
		/* Body color Dark */
		.fiskpay.bg-dark{
	
			background-color: rgba(22, 19, 38, 1);
		}	
	
		.fiskpay.bg-dark .fiskpay-messager{
			
			background-color: rgba(44, 38, 76, 0.3);
			color: rgba(224, 224, 224, 1);
		}	
	
		/* Body color Light */
		.fiskpay.bg-light{
	
			background-color: rgba(233, 236, 217, 1);
		}	
	
		.fiskpay.bg-light .fiskpay-messager{
			
			background-color: rgba(211, 217, 179, 0.3);
			color: rgba(31, 31, 31, 1);
		}
	
		/* Body color Black */
		.fiskpay.bg-black{
	
			background-color: rgba(5, 5, 5, 1);
		}	
	
		.fiskpay.bg-black .fiskpay-messager{
			
			background-color: rgba(44, 44, 44, 0.3);
			color: rgba(224, 224, 224, 1);
		}
	
		/* Body color White */
		.fiskpay.bg-white{
	
			background-color: rgba(250, 250, 250, 1);
		}	
	
		.fiskpay.bg-white .fiskpay-messager{
			
			background-color: rgba(211, 211, 211, 0.3);
			color: rgba(31, 31, 31, 1);
		}
		
		/* Body color Dark-Grey */
		.fiskpay.bg-dark-grey{
	
			background-color: rgba(39, 39, 40, 1);
		}	
	
		.fiskpay.bg-dark-grey .fiskpay-messager{
			
			background-color: rgba(113, 113, 118, 0.05);
			color: rgba(224, 224, 224, 1);
		}
		
		/* Body color Light-Grey */
		.fiskpay.bg-light-grey{
	
			background-color: rgba(113, 113, 118, 1);
		}	
	
		.fiskpay.bg-light-grey .fiskpay-messager{
			
			background-color: rgba(39, 39, 40, 0.05);
			color: rgba(224, 224, 224, 1);
		}
		
		/* Item color Dark */
		.fiskpay.dark{
	
			border: 2px solid rgba(22, 19, 38, 1);
		}
		
		.fiskpay.dark .fiskpay-label{
			
			color: rgba(22, 19, 38, 1);
		}	
		
		.fiskpay.dark .fiskpay-select{
			
			background-color: rgba(22, 19, 38, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(22, 19, 38, 1);
		}
		
		.fiskpay.dark .fiskpay-input{
			
			background-color: rgba(22, 19, 38, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(22, 19, 38, 1);
		}	
		
		.fiskpay.dark .fiskpay-pay{
			
			background-color: rgba(22, 19, 38, 1);
			color: rgba(224, 224, 224, 1);
		}			
			
		/* Item color Light */
		.fiskpay.light{
	
			border: 2px solid rgba(211, 217, 179, 1);
		}
		
		.fiskpay.light .fiskpay-label{
			
			color: rgba(211, 217, 179, 1);
		}	
		
		.fiskpay.light .fiskpay-select{
			
			background-color: rgba(211, 217, 179, 1);
			color: rgba(22, 22, 22, 1);
			border-color: rgba(211, 217, 179, 1);
		}
		
		.fiskpay.light .fiskpay-input{
			
			background-color: rgba(211, 217, 179, 0.95);
			color: rgba(22, 22, 22, 1);
			border-color: rgba(211, 217, 179, 1);
		}	
		
		.fiskpay.light .fiskpay-pay{
			
			background-color: rgba(211, 217, 179, 1);
			color: rgba(22, 22, 22, 1);
		}	
				
		/* Item color Black */
		.fiskpay.black{
	
			border: 2px solid rgba(5, 5, 5, 1);
		}
		
		.fiskpay.black .fiskpay-label{
			
			color: rgba(5, 5, 5, 1);
		}	
		
		.fiskpay.black .fiskpay-select{
			
			background-color: rgba(5, 5, 5, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(5, 5,5, 1);
		}
		
		.fiskpay.black .fiskpay-input{
			
			background-color: rgba(5, 5, 5, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(5, 5, 5, 1);
		}	
		
		.fiskpay.black .fiskpay-pay{
			
			background-color: rgba(5, 5, 5, 1);
			color: rgba(224, 224, 224, 1);
		}	
			
		/* Item color White */
		.fiskpay.white{
	
			border: 2px solid rgba(250, 250, 250, 1);
		}
		
		.fiskpay.white .fiskpay-label{
			
			color: rgba(250, 250, 250, 1);
		}	
		
		.fiskpay.white .fiskpay-select{
			
			background-color: rgba(250, 250, 250, 1);
			color: rgba(22, 22, 22, 1);
			border-color: rgba(250, 250,250, 1);
		}
		
		.fiskpay.white .fiskpay-input{
			
			background-color: rgba(250, 250, 250, 0.95);
			color: rgba(22, 22, 22, 1);
			border-color: rgba(250, 250,250, 1);
		}	
		
		.fiskpay.white .fiskpay-pay{
			
			background-color: rgba(250, 250, 250, 1);
			color: rgba(22, 22, 22, 1);
		}
		
		/* Item color Dark-Grey */
		.fiskpay.dark-grey{
	
			border: 2px solid rgba(39, 39, 40, 1);
		}
		
		.fiskpay.dark-grey .fiskpay-label{
			
			color: rgba(39, 39, 40, 1);
		}	
		
		.fiskpay.dark-grey .fiskpay-select{
			
			background-color: rgba(39, 39, 40, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(39, 39, 40, 1);
		}
		
		.fiskpay.dark-grey .fiskpay-input{
			
			background-color: rgba(39, 39, 40, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(39, 39, 40, 1);
		}	
		
		.fiskpay.dark-grey .fiskpay-pay::before{
			
			background-color: rgba(39, 39, 40, 1);
			color: rgba(224, 224, 224, 1);
		}
		
		/* Item color Light-Grey */
		.fiskpay.light-grey{
	
			border: 2px solid rgba(113, 113, 118, 1);
		}
		
		.fiskpay.light-grey .fiskpay-label{
			
			color: rgba(113, 113, 118, 1);
		}	
		
		.fiskpay.light-grey .fiskpay-select{
			
			background-color: rgba(113, 113, 118, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(113, 113, 118, 1);
		}
		
		.fiskpay.light-grey .fiskpay-input{
			
			background-color: rgba(113, 113, 118, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(113, 113, 118, 1);
		}	
		
		.fiskpay.light-grey .fiskpay-pay::before{
			
			background-color: rgba(113, 113, 118, 1);
			color: rgba(224, 224, 224, 1);
		}
		
		/* Item color Red */
		.fiskpay.red{
	
			border: 2px solid rgba(128, 0, 0, 1);
		}
		
		.fiskpay.red .fiskpay-label{
			
			color: rgba(128, 0, 0, 1);
		}	
		
		.fiskpay.red .fiskpay-select{
			
			background-color: rgba(128, 0, 0, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(128, 0, 0, 1);
		}
		
		.fiskpay.red .fiskpay-input{
			
			background-color: rgba(128, 0, 0, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(128, 0, 0, 1);
		}	
		
		.fiskpay.red .fiskpay-pay{
			
			background-color: rgba(128, 0, 0, 1);
			color: rgba(224, 224, 224, 1);
		}
	
		/* Item color Green */
		.fiskpay.green{
	
			border: 2px solid rgba(0, 128, 0, 1);
		}
		
		.fiskpay.green .fiskpay-label{
			
			color: rgba(0, 128, 0, 1);
		}	
		
		.fiskpay.green .fiskpay-select{
			
			background-color: rgba(0, 128, 0, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(0, 128, 0, 1);
		}
		
		.fiskpay.green .fiskpay-input{
			
			background-color: rgba(0, 128, 0, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(0, 128, 0, 1);
		}	
		
		.fiskpay.green .fiskpay-pay{
			
			background-color: rgba(0, 128, 0, 1);
			color: rgba(224, 224, 224, 1);
		}
	
		/* Item color Blue */
		.fiskpay.blue{
	
			border: 2px solid rgba(0, 0, 128, 1);
		}
		
		.fiskpay.blue .fiskpay-label{
			
			color: rgba(0, 0, 128, 1);
		}	
		
		.fiskpay.blue .fiskpay-select{
			
			background-color: rgba(0, 0, 128, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(0, 0, 128, 1);
		}
		
		.fiskpay.blue .fiskpay-input{
			
			background-color: rgba(0, 0, 128, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(0, 0, 128, 1);
		}	
		
		.fiskpay.blue .fiskpay-pay{
			
			background-color: rgba(0, 0, 128, 1);
			color: rgba(224, 224, 224, 1);
		}
		
		/* Item color Velvet */
		.fiskpay.velvet{
	
			border: 2px solid rgba(136, 36, 96, 1);
		}
	
		.fiskpay.velvet .fiskpay-label{
			
			color: rgba(136, 36, 96, 1);
		}	
		
		.fiskpay.velvet .fiskpay-select{
			
			background-color: rgba(136, 36, 96, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(136, 36, 96, 1);
		}
		
		.fiskpay.velvet .fiskpay-input{
			
			background-color: rgba(136, 36, 96, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(136, 36, 96, 1);
		}	
		
		.fiskpay.velvet .fiskpay-pay{
			
			background-color: rgba(136, 36, 96, 1);
			color: rgba(224, 224, 224, 1);
		}
		
		/* Item color Grass */
		.fiskpay.grass{
	
			border: 2px solid rgba(36, 136, 96, 1);
		}
		
		.fiskpay.grass .fiskpay-label{
			
			color: rgba(36, 136, 96, 1);
		}	
		
		.fiskpay.grass .fiskpay-select{
			
			background-color: rgba(36, 136, 96, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(36, 136, 96, 1);
		}
		
		.fiskpay.grass .fiskpay-input{
			
			background-color: rgba(36, 136, 96, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(36, 136, 96, 1);
		}	
		
		.fiskpay.grass .fiskpay-pay{
			
			background-color: rgba(36, 136, 96, 1);
			color: rgba(224, 224, 224, 1);
		}
		
		/* Item color Ocean */
		.fiskpay.ocean{
	
			border: 2px solid rgba(36, 96, 136, 1);
		}
	
		.fiskpay.ocean .fiskpay-label{
			
			color: rgba(36, 96, 136, 1);
		}	
		
		.fiskpay.ocean .fiskpay-select{
			
			background-color: rgba(36, 96, 136, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(36, 96, 136, 1);
		}
		
		.fiskpay.ocean .fiskpay-input{
			
			background-color: rgba(36, 96, 136, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(36, 96, 136, 1);
		}	
		
		.fiskpay.ocean .fiskpay-pay{
			
			background-color: rgba(36, 96, 136, 1);
			color: rgba(224, 224, 224, 1);
		}
	
		/* Item color Gold */
		.fiskpay.gold{
	
			border: 2px solid rgba(136, 96, 36, 1);
		}
	
		.fiskpay.gold .fiskpay-label{
			
			color: rgba(136, 96, 36, 1);
		}	
		
		.fiskpay.gold .fiskpay-select{
			
			background-color: rgba(136, 96, 36, 1);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(136, 96, 36, 1);
		}
		
		.fiskpay.gold .fiskpay-input{
			
			background-color: rgba(136, 96, 36, 0.95);
			color: rgba(224, 224, 224, 1);
			border-color: rgba(136, 96, 36, 1);
		}	
		
		.fiskpay.gold .fiskpay-pay{
			
			background-color: rgba(136, 96, 36, 1);
			color: rgba(224, 224, 224, 1);
		}
	
	`).replace(/\n/g, "").replace(/[\s]{2,}/g, " ");
document.head.appendChild(style);