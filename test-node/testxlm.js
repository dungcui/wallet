const stellarSdk = require ('stellar-sdk');
const fetch = require ('node-fetch');
// const pair = stellarSdk.Keypair.random();
// const privateKey = pair.secret();
// const publicKey = pair.publicKey();
// const publicKey = "GAGLKW6ITV5AQY66LTSRQA6LPRVJJFYB73ZGJIRDHDURSQ4YD2LYALKL"
const privateKey = "SCOEYDVC5N4FXRJERW7DVKWWUDH4PS3WUWYJUNVKXU5VGCFR5KP6RSYW"
const keyPair =  stellarSdk.Keypair.fromSecret(privateKey);
const publicKey = keyPair.publicKey();
console.log('publicKey:',publicKey);
async function main (){
    console.log('MAXIMUM:',Number.MAX_SAFE_INTEGER)
}

const a = main();

