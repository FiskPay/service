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

	if (preg_match("/^[a-zA-Z0-9\/\r\n+]*={0,2}$/", $iPNData) && $responseString = @file_get_contents("https://app.fiskpay.com/claimOrder/" . $iPNData . "/" . $wallet)) {

		if (($responseObject = json_decode($responseString)) !== null && property_exists($responseObject, 'error') && property_exists($responseObject, 'message') && property_exists($responseObject, 'data')) {

			if ($responseObject->error === false && ($orderObject = $responseObject->data->order)) {

				$network = $orderObject->network; 												// variable type: string - The network that the transaction took place
				$timestamp = $orderObject->timestamp; 											// variable type: string - The timestamp that this object was created
				$verification = $orderObject->verification; 									// variable type: string - The transaction verification

				$txHash = $orderObject->txHash; 												// variable type: string - The blockchain transaction hash
				$sender = $orderObject->sender; 												// variable type: string - The address where the funds are sent from
				$receiver = $orderObject->receiver; 											// variable type: string - The address where the funds are sent to. Should be equal to your wallet address ($wallet)

				$cryptoCurrencySymbol = $orderObject->cryptoCurrency->symbol; 					// variable type: string - The symbol of the cryptocurrency sent
				$cryptoCurrencyAmount = $orderObject->cryptoCurrency->amount; 					// variable type: string - The amount of the cryptocurrency sent
				$cryptoCurrencyTotalUSDValue = $orderObject->cryptoCurrency->totalUSDValue; 	// variable type: string - The total value of the cryptocurrency sent in USD
				$cryptoCurrencyUnitUSDValue = $orderObject->cryptoCurrency->unitUSDValue; 		// variable type: string - The value of 1 cryptocurrency in USD

				$fiatCurrencySymbol = $orderObject->fiatCurrency->symbol; 						// variable type: string - The symbol of the fiat currency that was used for the fiat to crypto conversion
				$fiatCurrencyAmount = $orderObject->fiatCurrency->amount; 						// variable type: string - The amount of fiat currency used for the converstion
				$fiatCurrencyTotalUSDValue = $orderObject->fiatCurrency->totalUSDValue; 		// variable type: string - The total value of the fiat currency used for the converstion in USD
				$fiatCurrencyUnitUSDValue = $orderObject->fiatCurrency->unitUSDValue;			// variable type: string - The value of 1 fiat currency in USD

				$postDataItem1 = $orderObject->postData->item1;									// variable type: any - The first callback item
				$postDataItem2 = $orderObject->postData->item2;									// variable type: any - The second callback item
				$postDataItem3 = $orderObject->postData->item3;									// variable type: any - The third callback item
				$postDataItem4 = $orderObject->postData->item4;									// variable type: any - The forth callback item

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

				if ($logTransactions == true) {

					$orderDir = "./FiskPayOrders/";

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