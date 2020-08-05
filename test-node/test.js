// const bitcore = require('bitcore-lib');
// const HdKey = require('ethereumjs-wallet/hdkey');

// 25e8f88c10e12550b4c8f28c87b6f1c5bd43b72c9a84d2e1dde50144af9193ee
// xprv9s21ZrQH143K4JHEQ8ZfZKYYgraKsUAKfmq8oa3awJXJCDcDzA1XBCe3MKjwCbEFMg7mPq6FoSwwtpq4gz36B4yT8khQsmrdkzhjLN5jp2j
// xpub661MyMwAqRbcGnMhWA6fvTVHEtQpGvtB2zkjbxTCVe4H51wNXhKmizxXCd2vULGaJRfXLnqLqMCxLgvrsk4vaJxQbZ59VFy4odtz7C6TttH-

// const seed = bitcore.crypto.Random.getRandomBuffer(32).toString('hex');
// console.log(seed);
// const seed = 'ea1e4dbb7506c58d1a987c77cf9afc0d7af69277fe2d0b7552204452cf3e6994'.toString('hex');
// const hdPrivateKey = bitcore.HDPrivateKey.fromSeed('25e8f88c10e12550b4c8f28c87b6f1c5bd43b72c9a84d2e1dde50144af9193ee');
// const hdPrivateKey = bitcore.HDPrivateKey('xprv9s21ZrQH143K4RGE7cM6TBXcWXz7y6GxnihY5gx89D4JWXgsaTALeqzakdbPo1UZQd4SK1qzVtT88vWnteZNxMYTsbXACscTvrUxXeTmMqS');
// console.log(hdPrivateKey);
// const hdPubKey = hdPrivateKey.hdPublicKey;
// console.log(hdPubKey);


// console.log(web3.utils.fromWei("10000"));

// const usdtLiveNet = {
//   name: 'usdtLiveNet',
//   alias: 'uLiveNet',
//   pubkeyhash: 0x05,
//   privatekey: 0x80,
//   scripthash: 0x00,
//   xpubkey: 0x0488b21e,
//   xprivkey: 0x0488ade4,
//   networkMagic: 0xf9beb4d9,
//   port: 8333,
//   dnsSeeds: [
//     'seed.bitcoin.sipa.be',
//     'dnsseed.bluematt.me',
//     'dnsseed.bitcoin.dashjr.org',
//     'seed.bitcoinstats.com',
//     'bitseed.xf2.org',
//     'seed.bitcoin.jonasschnelli.ch',
//   ],
// };

// const usdtTestNet = {
//   name: 'usdtTestNet',
//   alias: 'uTestNet',
//   pubkeyhash: 0xc4,
//   privatekey: 0xef,
//   scripthash: 0x6f,
//   xpubkey: 0x043587cf,
//   xprivkey: 0x04358394,
//   networkMagic: 0xf9beb4d9,
//   port: 8333,
//   dnsSeeds: [
//     'seed.bitcoin.sipa.be',
//     'dnsseed.bluematt.me',
//     'dnsseed.bitcoin.dashjr.org',
//     'seed.bitcoinstats.com',
//     'bitseed.xf2.org',
//     'seed.bitcoin.jonasschnelli.ch',
//   ],
// };

// Networks.add(usdtLiveNet);
// Networks.add(usdtTestNet);

// const address2 = hdPrivateKey.derive('m/0/0/91').privateKey;
// const { privateKey } = hdPrivateKey.derive('m');
// const address = privateKey.toAddress(Networks.livenet);
// const bitcoinAddress = privateKey.toAddress();

// // const address2 = privateKey.toAddress(Networks.get('usdtLiveNet'));
// console.log({ address2 });
// console.log({ address });
// console.log({ bitcoinAddress });
// console.log({ address2 });
// console.log(JSON.stringify(str));

//  const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/e8546a58c32d472790076824beaeae62'));
//  web3.eth.getBlock(3735000).then(block => {
//     console.log('block:', block);
// })
// web3.eth.getTransaction('0xa543a3a7b6498bc9aec6989d99228be07855cdd23cfbf491489e8d4088b4a94c').then(transaction =>
//     {console.log(transaction)}
//     )

const jayson = require('jayson');
const Promise = require('bluebird');
Promise.resolve
// this.nodeUrl = "http://admin:secret@103.42.57.234:8332";
// if (!this.nodeUrl) {
//   throw Error('Please provide BTC_NODE_URL');
// }
// this.client = Promise.promisifyAll(jayson.client.http(this.nodeUrl));
// const block =this.client.requestAsync('getblockcount', []).result;

// (block ? console.log(block):console.log("co gi dau"))

// const transactions =this.client.requestAsync('getrawtransaction', ["d17c373270be98e3f608075f0d0f425470429711987a01a79ca6d154a33f0fc2", 1]).result;
// (transactions ? console.log(transactions):console.log("co gi dau"))


// const debug = require('debug');
// const api = require('./src/lib/eos/eos_api.js');

// const Rpc = require('eosjs-api');

// options = {
//     httpEndpoint: 'http://95.216.69.201:8888', // default, null for cold-storage
//     verbose: false, // API logging
//     fetchConfiguration: {
//         credentials: 'same-origin'

//     },
//     fetchConfiguration: {},
//   }
// //  const fetch = require('node-fetch');           // node only; not needed in browsers
//  const rpc = Rpc(options);

  // const eos_rpc=rpc(config);
    // rpc.getBlock(48155).then(block => console.log(" 1 ",block))
// const raw ={
//     "code": "eosio.token",
//     "action": "transfer",
//     "args": {
//       "from": "dungdaica123",
//       "to": "binancecleos",
//       "quantity": "8 EOS",
//       "memo": "108409542"
//     }
//   }
//     // const data = JSON.stringify(raw);
//     //   console.log(raw.code)
    // rpc.getInfo({}).then(block => console.log(" 2 ",block))

    // rpc.getCurrencyBalance("eosio.token","dungdaica123").then(block => console.log(" 2 ",block))
    // rpc.abiJsonToBin(raw).then(block => console.log(" 2 ",block))
    // rpc.getActions("dungdaica123",-1,2).then(block => console.log(" 2 ",block))

    // rpc.get_block(48156).then(block => console.log(" 3 ",block))

    // rpc.get_block(48157).then(block => console.log(" 4 ",block))

    // rpc.get_block(48158).then(block => console.log(" 5 ",block))

    // rpc.get_block(4011).then(block => console.log(" 6 ",block))

    // rpc.get_block(1).then(block => 
    
    // {
    //     console.log(block);
    //     Promise.each(block.transactions, async (vout) => {
    //         Promise.each(vout.trx.transaction.actions, async (vout2) => {
    //             console.log(vout2)
    //         });
    //     });
    // });
    // let count =0;
    // rpc.get_info().then(block => 
    //     console.log(block)
    // )
    // rpc.history_get_transaction("0002bb4e837c6ff755e62a9edce648c85c8c12b11e7647a339aa8ff951209260").then(block => console.log(block));
    // rpc.getActions("dungdaica123",1,-3).then(block => 
    //     Promise.each(block.actions, async (vout) => {
    //         console.log(vout);

    //         // Promise.each(vout.action_trace.act.data, async(vout2) => {
    //         //  console.log(vout2);
    //         })
    //     // })
    // )

    // const { Api, JsonRpc, RpcError } = require('eosjs');
    // const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');      // development only
    // const fetch = require('node-fetch');                                    // node only; not needed in browsers
    // const { TextEncoder, TextDecoder } = require('util');                   // node only; native TextEncoder/Decoder
    // const { TextEncoder, TextDecoder } = require('text-encoding');  

    // const rpc = new  JsonRpc('http://95.216.69.201:8888', { fetch });

    // rpc.history_get_actions("dungdaica123",-1,-100).then(block => 
    //       Promise.each(block.actions, async (vout) => {
    //           console.log(vout.action_trace.act.data);
  
    //           // Promise.each(vout.action_trace.act.data, async(vout2) => {
    //           //  console.log(vout2);
    //           })
    //   )
      // )

        
        
        // })).catch(err => console.log(err));
    //             console.log(count);

    const { Api, JsonRpc, RpcError } = require('eosjs');
    const JsSignatureProvider = require('eosjs/dist/eosjs-jssig').default;

    const fetch = require('node-fetch');                                    // node only; not needed in browsers
    // const { TextEncoder, TextDecoder } = require('util');                   // node only; native TextEncoder/Decoder
    const { TextEncoder, TextDecoder } = require('text-encoding');          // React Native, IE11, and Edge Browsers only
    const defaultPrivateKey = "5J83gWcfJ8Q8EPMCLQZ8XV6SdEaGwQ2wVVQCTFo4ghuM4MDag77"; // bob
    console.log("JsSignatureProvider",JsSignatureProvider);
    const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);
    const rpc = new JsonRpc('http://95.216.69.201:8888', { fetch });
    const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
    // rpc.get_currency_balance("eosio.token","dungdaica123").then(block => console.log(block));
    api.transact({
        broadcast : true,
        sign : true,
        actions: [{
            account: 'kryptoniexan',
            name: 'transfer',
            authorization: [{
            actor: 'forestersmct',
            permission: 'active',
            }],
            data: {
            from: 'forestersmct',
            to: 'krpkryptonan',
            quantity: '1.0000 KRP',
            memo: '6550955380728459264',
            },
        }]
        }, {
        blocksBehind: 3,
        expireSeconds: 60,
        }).then(block => console.log(block));
// const Decimal = require('decimal.js');
// const SPACE = ' ';
// console.log([
//   new Decimal(1).mul(1.0000).toFixed(4),
//   'EOS',
// ].join(SPACE));
            
            
//             Promise.each(transaction.trx.transaction.actions, async (vout) => {
//             const { name , data } = vout;
//             const { addresses ,memo} = data.from;
//             let amount = null;
//             if (name === "transfer" && addresses && addresses.length > 0) {
//               [amount] = data.quantity.split(" ");;
//               outputs.push({
//                 inputs : null,
//                 blockHeight,
//                 height: blockHeight,
//                 currency: amount[1],
//                 feeCurrency: constants.FEE_CURRENCY,
//                 amount: amount[0] ,
//                 to: addresses,
//                 toAddress:  null,
//                 transactionHash: transactions.trx.id,
//                 outputIndex: 0,
//                 script: scriptPubKey.hex,
                
//               });
//               }
//               console.log(outputs);
//     });

// });
// });
    
// const { Api, JsonRpc, RpcError } = require('eosjs');
// const JsSignatureProvider = require('eosjs/dist/eosjs-jssig').default;;  // development only
// const fetch = require('node-fetch');                            // node only; not needed in browsers
// const { TextEncoder, TextDecoder } = require('util');           // node only; native TextEncoder/Decoder
// // const { TextEncoder, TextDecoder } = require('text-encoding');


// const defaultPrivateKey = "5J83gWcfJ8Q8EPMCLQZ8XV6SdEaGwQ2wVVQCTFo4ghuM4MDag77"; // useraaaaaaaa
// const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

// const rpc = new JsonRpc('http://node.dungdondap.ml:8888', { fetch });

// const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

// (async () => {
//     const result = await api.transact({
//       actions: [{
//         account: 'kryptoniexan',
//         name: 'transfer',
//         authorization: [{
//           actor: 'forestersmct',
//           permission: 'active',
//         }],
//         data: {
//           from: 'forestersmct',
//           to: 'foresterxian',
//           quantity: '4.76190476 EOS',
//           memo: '6566951071405584384',
//         },
//       }]
//     }, {
//       blocksBehind: 3,
//       expireSeconds: 30,
//     });
//     console.dir(result);
//   })();
  
  
  



// // console.log(Number('0.11111'));

// web3.eth
//   .isSyncing()
//   .then(console.log)
//   .catch((err) => {
//     console.log(err);
//   });

// web3.eth.getBlockNumber().then(console.log);

// web3.eth.getBlockNumber().then(console.log);

// web3.eth.getBlock(6724622, false).then(console.log);
// web3.eth.getBlock(6724557, false).then((val) => {
//   console.log(val);
// });

// web3.eth.getTransaction('0xf892ead19175766532ad11b2034e5baf04547d946c560f857df1a55e101c5554').then(console.log);

// web3.eth.getTransaction('0x393407a3c2b231a39a25d344df61097596ace3ee7a5f47deff86c51e82da63e5').then(val => {
//   console.log(val);
// })

// web3.eth.getTransaction('0x393407a3c2b231a39a25d344df61097596ace3ee7a5f47deff86c51e82da63e5').then(val => {
//   console.log(val);
// })
// async function signTx() {
//   const privateKey = Buffer.from('da2c7cac3dcb5e1257b1539d1f40accc7519462ce7668bfb6e439465c12db5df', 'hex');
//   const gasPrice = new web3.utils.BN(web3.utils.toWei('9', 'gwei'));
//   const gasLimit = new web3.utils.BN(21000);
//   const txCount = await web3.eth.getTransactionCount('0x308751b212dbb5ebed0e421951683c1515dd35d2');
//   console.log('tx count:', txCount);
//   console.log('fee:', gasPrice.mul(gasLimit));
//   const amount = new web3.utils.BN(web3.utils.toWei('0.25', 'ether'));
//   const txOptions = {
//     nonce: web3.utils.toHex(txCount),
//     gasLimit,
//     gasPrice,
//     to: '0xB24E8bf28130bFF1779534d68323D5428650c1af',
//     value: amount,
//   };

//   const tx = new EthereumTx(txOptions);
//   tx.sign(privateKey);
//   console.log('sender:', '0x' + tx.getSenderAddress().toString('hex'));
//   return tx.serialize().toString('hex');
// }

// // signTx().then(val => {
// //     console.log(`0x${val}`);
// // })
// signTx().then((val) => {
//   web3.eth.sendSignedTransaction(`0x${val}`)
//     .on('transactionHash', (txHash) => {
//       console.log('tx hash:', txHash);
//     })
//     .on('receipt', (data) => {
//       console.log('on recept:', data);
//     })
//     .on('error', (err) => {
//       console.log('on err:', err);
//     })
//     .on('confirmation', (confNumber, receipt) => {
//       console.log('on confirmation', confNumber, ', receipt:', receipt);
//     });
// });
// const pk = Buffer.from(privateKey, 'hex');
// const gasPrice = new web3.utils.BN(web3.utils.toWei('9', 'gwei'));
// const gasLimit = new web3.utils.BN(21000);

// console.log(gasPrice.mul(gasLimit).toString(10));
// const amount = new web3.utils.BN(web3.utils.toWei('0.2', 'ether'));

// const tx = new EthereumTx({
//     nonce: '0x12',
//     gasPrice: gasPrice,
//     gasLimit: gasLimit,
//     to: '0x308751b212dbb5ebed0e421951683c1515dd35d2',
//     value: amount,
//     data: "0x",
// });
// tx.sign(pk);
// console.log('raw transaction:', '0x' + tx.getSenderAddress().toString('hex'));
// console.log('sender address:', tx.getSenderAddress());

// // console.log(web3.utils.sha3(tx.serialize(), {encoding: 'hex'}));
// // console.log(`0x${tx.serialize().toString('hex')}`);
// web3.eth.sendSignedTransaction('0x' + tx.serialize().toString('hex'))
// .on('receipt', data => {
//     console.log('on receipt:', data);
// })
// .on('error', err => {
//     console.log('on error:', err);
// }).then(val => {
//     console.log(val);
// });

// web3.eth.getTransactionCount('')
// console.log('private key:', privateKey.toString('hex'));

// const seed = web3.utils.randomHex(32);
// console.log(seed);
// // const seed = '0xea1e4dbb7506c58d1a987c77cf9afc0d7af69277fe2d0b7552204452cf3e6994';
// // const seed1 = '0x7140f693e4cf452371341737090abec692b62fade19b4831280405e11aabbdab'; // Nam
// const hdKey = HdKey.fromMasterSeed(seed);
// console.log('hd private key:', hdKey.privateExtendedKey());
// console.log('hd public key:', hdKey.publicExtendedKey());

// const hdnode = hdKey.derivePath('m/0/0/91');
// console.log('hd node:', hdnode.getWallet().getPrivateKeyString());
// console.log('address:', hdnode.getWallet().getAddressString());

// const hdnode = hdkey.derivePath('m/0/1/0');

// const hdPublicKey = HdKey.fromExtendedKey(hdnode.publicExtendedKey());
// console.log('hd public key:', hdPublicKey.publicExtendedKey());
// console.log('address:', hdPublicKey.getWallet().getAddressString());
// const xpriv = hdnode.privateExtendedKey();
// console.log('xpriv:', xpriv);
// const xpubs = hdnode.publicExtendedKey();
// console.log('xpubs:', xpubs);
// // console.log(hdnode.getWallet().getAddressString());

// // console.log(hdkey);

// const xpriv2 = HdKey.fromExtendedKey('xprv9y2aaFZBiyG3Eo8W7PJhe6LtKFDsrpZhL5amC68AYLGxSfGQifuC2c1VQetxrYqUzkEGFnY6d4wYFhy5qLvmUS7HX5BgQpwn1djuWtJ299v');
// console.log(xpriv2.publicExtendedKey());

// console.log(hd.getPrivateKeyString());

// var web3 = new Web3(new Web3.providers.HttpProvider('http://95.216.69.201:8545'));

// console.log(web3.utils.isAddress('0x60fcde93e5874dfa47cf553c1b80fd1cd1a4cbad'));


// const LTC_MAINNET = {
//     name: 'ltcmainnet',
//     alias: 'ltcmainnet',
//     pubkeyhash: 0x30,
//     privatekey: 0xB0,
//     scripthash: 0x5,
//     xpubkey:  0X0488B21E,
//     xprivkey: 0X0488ADE4,
//     port: 9333
//     }

// const { Address, HDPublicKey, Networks } = require('bitcore-lib');

// Networks.add(LTC_MAINNET);
// try
// {  
//     const address = Address.fromString('LZJwWqQobc2e6TTFju2wpRpS496E3qSzG1', Networks.get("ltcmainnet"));
//     console.log(address.toString());
// }catch(err )
// {
//     console.log(err);

// }

// var HDKey = require('hdkey')

// const { keccak256 } = require('js-sha3');
// const { encode: encodeBase58 } = require('bs58');
// const JsSHA = require('jssha');
// const { ec: EllipticCurve } = require('elliptic');

// const ADDRESS_PREFIX = '41';

// function computeAddress(tronPublicHex) {
//   const buffer = Buffer.from(tronPublicHex, 'hex');
//   const hash = keccak256(buffer).toString();
//   return ADDRESS_PREFIX + hash.substring(24);
// }

// function getSHA256(msgHex) {
//   const shaObj = new JsSHA('SHA-256', 'HEX');
//   shaObj.update(msgHex);
//   return shaObj.getHash('HEX');
// }

// function getBase58CheckAddress(addressHex) {
//   const checkSum = getSHA256(getSHA256(addressHex)).slice(0, 8);
//   const buffer = Buffer.from(addressHex + checkSum, 'hex');
//   return encodeBase58(buffer);
// }

// function getTronPublicKeyHex(publicKey) {
//   const ec = new EllipticCurve('secp256k1');
//   const key = ec.keyFromPublic(publicKey.toString('hex'), 'hex');
//   const { x, y } = key.getPublic();
//   const xHex = x.toString('hex').padStart(64, '0');
//   const yHex = y.toString('hex').padStart(64, '0');
//   return xHex + yHex;
// }

// function getAddressFromPublicKey(publicKey) {
//   const tronPublicHex = getTronPublicKeyHex(publicKey);
//   const address = computeAddress(tronPublicHex);
//   return getBase58CheckAddress(address);
// }

// try {
//     // const str ="0459B7B990CC7086B8493DD56FE2BD68866514A7F6137DAC45237BB842446D7ACDE25FB9BE8D0B48F301ED70AB96D77BB74E1ECE489FCD08051258A91C7A67805D";

//     // const buffer = Buffer.from(str, 'hex');



    
//     // const address = getAddressFromPublicKey("0459B7B990CC7086B8493DD56FE2BD68866514A7F6137DAC45237BB842446D7ACDE25FB9BE8D0B48F301ED70AB96D77BB74E1ECE489FCD08051258A91C7A67805D");
//     // const buffer= Buffer("0459B7B990CC7086B8493DD56FE2BD68866514A7F6137DAC45237BB842446D7ACDE25FB9BE8D0B48F301ED70AB96D77BB74E1ECE489FCD08051258A91C7A67805D");
//     // console.log(encodeBase58(buffer));

//     var key = 'xpub661MyMwAqRbcGMrvsb7VK3TSngAwYcAL2zbb2E48NqSgdAS3c1xLnqDEfD3iS6Z4osS6AcG1cD2igFo6ntpfEt4te7NQGnKzq1419bJxbcR'
//     var hdkey = HDKey.fromExtendedKey(key)

//     console.log(hdkey.toJSON())
//     // hdkey.fromExtendedKey("0459B7B990CC7086B8493DD56FE2BD68866514A7F6137DAC45237BB842446D7ACDE25FB9BE8D0B48F301ED70AB96D77BB74E1ECE489FCD08051258A91C7A67805D");
//   } catch (err) {
//     console.log(err);
//   }



// const RippleAPI = require('ripple-lib').RippleAPI;
// var test_server = 'wss://s2.ripple.com';
// const api = new RippleAPI({
//     server: test_server // Public rippled server
// });
// api.connect().then(() => {
//     /* begin custom code ------------------------------------ */
//     const myAddress = 'rf1BiGeXwwQoi8Z2ueFYTEXSwuJYfV2Jpn';
//     console.log('getting account info for', myAddress);
//     return api.getTransactions(myAddress);
// }).then(info => {
//     console.log(info);
//     /* end custom code -------------------------------------- */
// }).then(() => {
//     return api.disconnect();
// }).then(() => {
//     console.log('done and disconnected.');
// }).catch(console.error);





// client = Promise.promisifyAll(jayson.client.http("http://admin:secret@95.216.2.19:8332"));

// client.requestAsync('getblockhash', [573735]).then(block => console.log(block));

// client.requestAsync('getblock', ["000000000000000002e3ad60fef23709aaaa6330f442f7aae061b7e518a3906b", true]).then(block => console.log(block));


// client.requestAsync('sendrawtransaction', ["010000000146960a2365082952c2bb443e8a6172bb6f99d323a74fb205e1c1d0f3b7468099010000006b483045022100fdde6f0f3bc1ccde60aeda38e395e7fd1c8ba07fa1c743b6a67c3d976435674b022071f3c67d490e8e92cea9e4b835fd51fff967a20ebd6fbbcc1b8faa199a64d42a012103c5436f99732e3e1f2fc2349dd09930d6c72b4281672c3fe59fbbb9ea72341aaaffffffff0264518f01000000001976a9140832bcca18f17acaf08277ca1f20950ca422dd6c88acf0e13c00000000001976a914c9a87f0f0c765a8c967eed724e791c7341bad8e088ac00000000"]).then(block => 
//     console.log(block));
//     // Promise.each(block.result.vout[1])
//     // , async (v) => {
//     //             console.log(v);
//     //             // Promise.each(vout.action_trace.act.data, async(vout2) => {
//     //             //   console.log(vout.action_trace.act);
//     //           });
    
//     const snakeCaseKeys = require('snakecase-keys');

// const json={
// 	"type": "move_fund",
// 	"transactions": [{
// 			"id": 7,
// 			"from_path": "0/0/22",
// 			"to_path": "0/1/0",
// 			"gross_amount": "9.98778864",
// 			"currency": "USDT"
// 		},
// 		{
// 			"id": 3,
// 			"from_path": "0/0/22",
// 			"to_path": "0/1/0",
// 			"gross_amount": "8.98743656",
// 			"currency": "USDT"
// 		}
// 	],
// 	"meta": {
// 		"wallet_id": 9
// 	}
// }

// const option = { deep: false };
// //  payload: JSON.stringify(snakeCaseKeys(payload, option)) ;
// const json2= snakeCaseKeys(json) ;
// // // console.log(json2);
// const Web3 = require('web3');

// // const web3 = new Web3();
// const web3 = new Web3();

// const InputDataDecoder = require('ethereum-input-data-decoder');
// const api =[{"inputs": [{"type": "address", "name": ""}], "constant": true, "name": "isInstantiation", "payable": false, "outputs": [{"type": "bool", "name": ""}], "type": "function"}, {"inputs": [{"type": "address[]", "name": "_owners"}, {"type": "uint256", "name": "_required"}, {"type": "uint256", "name": "_dailyLimit"}], "constant": false, "name": "create", "payable": false, "outputs": [{"type": "address", "name": "wallet"}], "type": "function"}, {"inputs": [{"type": "address", "name": ""}, {"type": "uint256", "name": ""}], "constant": true, "name": "instantiations", "payable": false, "outputs": [{"type": "address", "name": ""}], "type": "function"}, {"inputs": [{"type": "address", "name": "creator"}], "constant": true, "name": "getInstantiationCount", "payable": false, "outputs": [{"type": "uint256", "name": ""}], "type": "function"}, {"inputs": [{"indexed": false, "type": "address", "name": "sender"}, {"indexed": false, "type": "address", "name": "instantiation"}], "type": "event", "name": "ContractInstantiation", "anonymous": false}];

//     const decoder = new InputDataDecoder(api);
// web3.setProvider(new Web3.providers.HttpProvider("http://95.216.227.170:8545"));
// // // console.log(web3.utils.keccak256("0xf86b01850218711a00825208941f7653fbe94cc1e37b64b3c7d2db15f7c55abf1687b1a2bc2ec50000801ca05a2dc602290aa80c8ab2a25791878fc8b84f7230f42b0e9325bcbe9c6ec92927a01de23c94b8a3d36af60a415ae6d338462fc01449ab8d5387fa96c0dade59bb36"));
// web3.eth.getBlockNumber().then(block => console.log("block 2",block));
// // web3.eth.getTransactionCount("0x87d9ef8951de64b7246fdb7c7d5a52760677f361")
// // .then(console.log);
// const value=91715940;
// console.log(new web3.utils.BN(web3.utils.toWei(`${value}`, "ether")))

// const StellarSdk= require('stellar-sdk');
// const fetch = require('node-fetch');  

// async function  addkey(pair)
// {

//     try {
//         const response = await fetch(
//         `https://stellar.org?addr=${encodeURIComponent(pair.publicKey())}`
//         );
//         const responseJSON = await response.json();
//         console.log("SUCCESS! You have a new account :)\n", responseJSON);
//     } catch (e) {
//         console.error("ERROR!", e);
//     }
//   }

// const server = new StellarSdk.Server("https://horizon.stellar.org");
// const pair = StellarSdk.Keypair.fromSecret("SCNXYAQID3RZT6JAUT6SU37OZS7UVB5BAJ4VQHB6DZTHTOB6BNO4Z4HY");

// addkey(pair).then(result => console.log(result))
// console.log(pair.secret());
// // SAV76USXIJOBMEQXPANUOQM6F5LIOTLPDIDVRJBFFE2MDJXG24TAPUU7
// console.log(pair.publicKey());


// // the JS SDK uses promises for most actions, such as retrieving an account
// server.loadAccount(pair.publicKey()).then (account => console.log(account)
// console.log("Balances for account: " + pair.publicKey());
// account.balances.forEach(function(balance) {
//   console.log("Type:", balance.asset_type, ", Balance:", balance.balance);

// )
// })
// const decimals = new Decimal('18').toNumber();
// c

// const input ="0xa9059cbb000000000000000000000000bfed0249222897beeaa344b07b98f322f6fcd90700000000000000000000000000000000000000000000272d77666db612ec0000";
// const utils = require('./src/lib/erc20/erc20_utils');
// const canoeSolidity = require('canoe-solidity');
//  const contractABI = {
//     'abi': [
//         {
//             "constant": true,
//             "inputs": [],
//             "name": "name",
//             "outputs": [
//                 {
//                     "name": "",
//                     "type": "string"
//                 }
//             ],
//             "payable": false,
//             "stateMutability": "view",
//             "type": "function"
//         },
//         {
//             "constant": false,
//             "inputs": [
//                 {
//                     "name": "_spender",
//                     "type": "address"
//                 },
//                 {
//                     "name": "_value",
//                     "type": "uint256"
//                 }
//             ],
//             "name": "approve",
//             "outputs": [
//                 {
//                     "name": "",
//                     "type": "bool"
//                 }
//             ],
//             "payable": false,
//             "stateMutability": "nonpayable",
//             "type": "function"
//         },
//         {
//             "constant": true,
//             "inputs": [],
//             "name": "totalSupply",
//             "outputs": [
//                 {
//                     "name": "",
//                     "type": "uint256"
//                 }
//             ],
//             "payable": false,
//             "stateMutability": "view",
//             "type": "function"
//         },
//         {
//             "constant": false,
//             "inputs": [
//                 {
//                     "name": "_from",
//                     "type": "address"
//                 },
//                 {
//                     "name": "_to",
//                     "type": "address"
//                 },
//                 {
//                     "name": "_value",
//                     "type": "uint256"
//                 }
//             ],
//             "name": "transferFrom",
//             "outputs": [
//                 {
//                     "name": "",
//                     "type": "bool"
//                 }
//             ],
//             "payable": false,
//             "stateMutability": "nonpayable",
//             "type": "function"
//         },
//         {
//             "constant": true,
//             "inputs": [],
//             "name": "decimals",
//             "outputs": [
//                 {
//                     "name": "",
//                     "type": "uint8"
//                 }
//             ],
//             "payable": false,
//             "stateMutability": "view",
//             "type": "function"
//         },
//         {
//             "constant": true,
//             "inputs": [
//                 {
//                     "name": "_owner",
//                     "type": "address"
//                 }
//             ],
//             "name": "balanceOf",
//             "outputs": [
//                 {
//                     "name": "balance",
//                     "type": "uint256"
//                 }
//             ],
//             "payable": false,
//             "stateMutability": "view",
//             "type": "function"
//         },
//         {
//             "constant": true,
//             "inputs": [],
//             "name": "symbol",
//             "outputs": [
//                 {
//                     "name": "",
//                     "type": "string"
//                 }
//             ],
//             "payable": false,
//             "stateMutability": "view",
//             "type": "function"
//         },
//         {
//             "constant": false,
//             "inputs": [
//                 {
//                     "name": "_to",
//                     "type": "address"
//                 },
//                 {
//                     "name": "_value",
//                     "type": "uint256"
//                 }
//             ],
//             "name": "transfer",
//             "outputs": [
//                 {
//                     "name": "",
//                     "type": "bool"
//                 }
//             ],
//             "payable": false,
//             "stateMutability": "nonpayable",
//             "type": "function"
//         },
//         {
//             "constant": true,
//             "inputs": [
//                 {
//                     "name": "_owner",
//                     "type": "address"
//                 },
//                 {
//                     "name": "_spender",
//                     "type": "address"
//                 }
//             ],
//             "name": "allowance",
//             "outputs": [
//                 {
//                     "name": "",
//                     "type": "uint256"
//                 }
//             ],
//             "payable": false,
//             "stateMutability": "view",
//             "type": "function"
//         },
//         {
//             "payable": true,
//             "stateMutability": "payable",
//             "type": "fallback"
//         },
//         {
//             "anonymous": false,
//             "inputs": [
//                 {
//                     "indexed": true,
//                     "name": "owner",
//                     "type": "address"
//                 },
//                 {
//                     "indexed": true,
//                     "name": "spender",
//                     "type": "address"
//                 },
//                 {
//                     "indexed": false,
//                     "name": "value",
//                     "type": "uint256"
//                 }
//             ],
//             "name": "Approval",
//             "type": "event"
//         },
//         {
//             "anonymous": false,
//             "inputs": [
//                 {
//                     "indexed": true,
//                     "name": "from",
//                     "type": "address"
//                 },
//                 {
//                     "indexed": true,
//                     "name": "to",
//                     "type": "address"
//                 },
//                 {
//                     "indexed": false,
//                     "name": "value",
//                     "type": "uint256"
//                 }
//             ],
//             "name": "Transfer",
//             "type": "event"
//         }
//     ]
//   };

//   let bytecodeExample = '0xa9059cbb000000000000000000000000247223ecf02026f2a520a5cad06aea7298a242e200000000000000000000000000000000000000000000001570aa428d1afe0000';
//   const result =utils.decodeFunctionArgs(contractABI.abi, bytecodeExample);
//   console.log("result",result);


                                 
//   var Web3 = require('web3');
//   var web3 = new Web3(new Web3.providers.HttpProvider());
//   var version = web3.version.api;
          
//   getJSON('http://api.etherscan.io/api?module=contract&action=getabi&address=0xd17bacbcdd67cf495cf5a64947814a5cd58959ef', function (data) {
//       var contractABI = "";
//       contractABI = JSON.parse(data.result);
//       if (contractABI != ''){
//           var MyContract = web3.eth.contract(contractABI);
//           var myContractInstance = MyContract.at("0xd17bacbcdd67cf495cf5a64947814a5cd58959ef");
//           var result = myContractInstance.memberId("0x900d319ef39582b98c9b456b6bc28e0a694837a1");
//           console.log("result1 : " + result);            
//           var result = myContractInstance.members(1);
//           console.log("result2 : " + result);
//       } else {
//           console.log("Error" );
//       }            
//   });

  // console.log(web3.utils.toAscii("0xa9059cbb000000000000000000000000bfed0249222897beeaa344b07b98f322f6fcd90700000000000000000000000000000000000000000000272d77666db612ec0000"))

// const result = decoder.decodeData("0xa9059cbb");
 
// console.log(new Decimal(result[1].data).div(Math.pow(10,18)).toString());