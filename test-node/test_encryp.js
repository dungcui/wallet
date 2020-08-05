var aes256 = require('aes256');
 
 var key = 'Sh7bRMkhc9';
const json ={currency:"ERC20",walletId:10,transactions:[{id:-1,amount:1,address:"0x340070920937aeaf0387052f1924d6e536f15ec1",currency:"OMG"}],type:"withdrawal"}
const jsonStr = JSON.stringify(json);
var plaintext = jsonStr;
 
var encrypted = aes256.encrypt(key, plaintext);
var decrypted = aes256.decrypt(key, encrypted);
console.log("encrypted",encrypted);
console.log("decrypted",decrypted);

console.log("json ",JSON.parse(decrypted));


// var encrypted2 = aes256.encrypt("Itvietsoftwallet!^%", "POFWSPl5PreYzKqYYlOzoA");
// var decrypted2 = aes256.decrypt(key, 'POFWSPl5PreYzKqYYlOzoA');

// console.log(decrypted2);

const crypto = require('crypto')
  , text = {currency:"KRP",walletId:1,transactions:[{id:1,amount:1,address:"krpkryptonan,memo:6550955380728459264",currency:"KRP"},{id:2,amount:2,address:"krpkryptonan,memo:6550955380728459264",currency:"KRP"},{id:3,amount:3,address:"krpkryptonan,memo:6550955380728459264",currency:"KRP"}],type:"withdrawal"}
const body = JSON.stringify(text);
hmac = crypto.createHmac('sha256', 'XYOcxRhEKlmVm0pC');    
hmac.write(body); // write in to the stream
hmac.end();       // can't read from the stream until you call end()
hash = hmac.read().toString('hex');    // read out hmac digest
console.log("Method 1: ", hash);


//   , key = 'S;h7b"./)R?Mkhc9'
hmac = crypto.createHmac('sha256', 'XYOcxRhEKlmVm0pC');
hmac.update(body);
hash = hmac.digest('hex');
console.log("Method 2: ", hash);