const RippleAPI = require('ripple-lib').RippleAPI;


class XrpTransApi {
    constructor({ xrpApiUrl }) {
        this.nodeUrl = xrpApiUrl;
        if (!this.nodeUrl) {
          throw Error('Please provide XRP_NODE_URL');
        }
         this.api = new RippleAPI({
            server: this.nodeUrl // Public rippled server hosted by Ripple, Inc.
          });
      }
      async getSimpleTransactions(settementAddress,grossAmount,toAddress,memo) {
        await this.api.connect();  
        const preparedTx = await this.api.prepareTransaction({
            "TransactionType": "Payment",
            "Account": settementAddress,
            "Amount": this.api.xrpToDrops(grossAmount), // Same as "Amount": "2000000"
            "Destination": toAddress,
            "DestinationTag": memo
            },{
                // Expire this transaction if it doesn't execute within ~5 minutes:
                "maxLedgerVersion": null
            }
        )
        await this.api.disconnect();
        console.log("preparedTx.txJSON",preparedTx.txJSON);
        return preparedTx.txJSON;
        
      } 
}
module.exports = XrpTransApi ;