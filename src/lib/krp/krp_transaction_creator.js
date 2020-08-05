// const { Api, JsonRpc, RpcError } = require('eosjs');
// const { Api, JsonRpc, RpcError } = require('eosjs/dist/eosjs-jssig'); 


const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');      // development only
const fetch = require('node-fetch');                                    // node only; not needed in browsers
const { TextEncoder, TextDecoder } = require('util');                   // node only; native TextEncoder/Decoder
// const { TextEncoder, TextDecoder } = require('text-encoding');          // React Native, IE11, and Edge Browsers only


const defaultPrivateKey = "5JtUScZK2XEp3g9gh7F8bwtPTRAkASmNrrftmx4AxDKD5K4zDnr"; // bob
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new JsonRpc('http://95.216.69.201:8888', { fetch });

const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });



async function createSimpleTransaction(operation) {
console.log(operation);
console.log("operation.method",operation.method);
console.log("operation.ref_block_num & 0xffff",operation.ref_block_prefix);

const result = await api.transact({
    expiration: operation.expiration,
    ref_block_num: operation.ref_block_num  ,
    ref_block_prefix: operation.ref_block_prefix,
    actions: [{
      account: 'kryptoniexan',
      name: operation.method,
      authorization: [{
        actor: operation.from,
        permission: 'active',
      }],
      data: {
        from: operation.from,
        to: operation.to,
        quantity: operation.amount,
        memo: operation.memo,
      },
    }]
  }, {
    authorization:`${operation.from}@active`,
    broadcast : false,
    sign : false,
    // chainId:operation.chain_id,
  });
  console.log("result",result);
  return result;

}

  module.exports = { createSimpleTransaction };