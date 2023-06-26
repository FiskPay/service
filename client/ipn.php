<?php

/*
 * @package    fiskpay_ipn.php
 *
 * @copyright  (C) FiskPay https://fiskpay.com/
 * @license    GNU General Public License version 2 or later;
 */

//Add your wallet address in the $wallet parameter.
$wallet = "0x41dA7A1e5085179F43758dC5F0a5bBEB012E07F1";

//Set $logTransactions parameter as true, to create a json file on transaction received.
$logTransactions = true;

//-----------------------------------------------------------------------------------------------------------------------------------------------------------------//
//------------------------------------------------------------ DO NOT EDIT THE CODE BELOW THIS COMMENT ------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------------------------------------------------------//

if ($_SERVER['REQUEST_METHOD'] === "POST" && ($iPNData = @file_get_contents('php://input'))) {

	if ($responseString = @file_get_contents("http://127.0.0.1/claimOrder/" . $iPNData)) {

		if (($responseObject = json_decode($responseString)) !== null && property_exists($responseObject, 'error') && property_exists($responseObject, 'message') && property_exists($responseObject, 'data')) {

			if ($responseObject->error === false && $responseObject->data !== null) {

				$orderObject = $responseObject->data->order;
				$orderDir = "./FiskPayOrders/invalid/";


				$network = $orderObject->network; // The network that the transaction took place
				$timestamp = $orderObject->timestamp; // The timestamp that this object was created
				$verification = $orderObject->verification; // The transaction verification

				$txHash = $orderObject->txHash; // The blockchain transaction hash
				$sender = $orderObject->sender; // The address where the funds are sent from
				$receiver = $orderObject->receiver; // The address where the funds are sent to

				$cryptoCurrencySymbol = $orderObject->cryptoCurrency->symbol; // The symbol of the crypto currency sent
				$cryptoCurrencyAmount = $orderObject->cryptoCurrency->amount; // The amount of the crypto currency sent
				$cryptoCurrencyTotalUSDValue = $orderObject->cryptoCurrency->totalUSDValue; // The total value of the crypto currency sent in USD
				$cryptoCurrencyUnitUSDValue = $orderObject->cryptoCurrency->unitUSDValue; // The value of 1 crypto currency in USD

				$fiatCurrencySymbol = $orderObject->fiatCurrency->symbol; // The symbol of the fiat currency that was used for the fiat to crypto conversion
				$fiatCurrencyAmount = $orderObject->fiatCurrency->amount; // The amount of fiat currency used for the converstion
				$fiatCurrencyTotalUSDValue = $orderObject->fiatCurrency->totalUSDValue; // The total value of the fiat currency used for the converstion in USD
				$fiatCurrencyUnitUSDValue = $orderObject->fiatCurrency->unitUSDValue; // The value of 1 fiat currency in USD

				$postDataItem1 = $orderObject->postData->item1; // The first callback item
				$postDataItem2 = $orderObject->postData->item2; // The second callback item
				$postDataItem3 = $orderObject->postData->item3; // The third callback item
				$postDataItem4 = $orderObject->postData->item4; // The forth callback item


				if (strtolower($wallet) == strtolower($receiver)) {

					//-----------------------------------------------------------------------------------------------------------------------------------------------------------------//
//------------------------------------------------------------ DO NOT EDIT THE CODE ABOVE THIS COMMENT ------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------------------------------------------------------//

					if ($network === "0x89") {


						//>-----------------------------------------------------------------------------------------------------------------------<//
						//>-----------------------------------------------------------------------------------------------------------------------<//
						//>                                                                                                                       <//
						//>               Replace these comments, with the code you want to execute on a unique mainnet transaction               <//
						//>                                                                                                                       <//
						//>-----------------------------------------------------------------------------------------------------------------------<//
						//>-----------------------------------------------------------------------------------------------------------------------<//


					} else if ($network === "0x13881") {


						//>-----------------------------------------------------------------------------------------------------------------------<//
						//>-----------------------------------------------------------------------------------------------------------------------<//
						//>                                                                                                                       <//
						//>               Replace these comments, with the code you want to execute on a unique testnet transaction               <//
						//>                                                                                                                       <//
						//>-----------------------------------------------------------------------------------------------------------------------<//
						//>-----------------------------------------------------------------------------------------------------------------------<//


					}

					//-----------------------------------------------------------------------------------------------------------------------------------------------------------------//
//------------------------------------------------------------ DO NOT EDIT THE CODE BELOW THIS COMMENT ------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------------------------------------------------------//

					$orderDir = "./FiskPayOrders/valid/";
				}

				if ($logTransactions == true) {

					if (is_dir($orderDir) == false)
						mkdir($orderDir, 0750, true);

					$orderHandler = fopen(($orderDir . $network . "_" . $verification . ".json"), 'w');
					fwrite($orderHandler, json_encode($orderObject));
					fflush($orderHandler);
					fclose($orderHandler);
				}
			}
		}
	}
}

?>