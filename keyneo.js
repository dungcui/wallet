const Neon = require("@cityofzion/neon-js");
const bitcore = require("bitcore-lib");
var HDPrivateKey = bitcore.HDPrivateKey;
var HDPrivateKey = new HDPrivateKey();
const privateKey = HDPrivateKey.privateKey.toString("hex");
try {
    const tempWallet = new Neon.wallet.Account(privateKey.toString("hex"));
    console.log("wallet address", tempWallet);
    console.log("privateKey", privateKey.toString("hex"));

}
catch (err) {
    console.log("err on " + privateKey);
}