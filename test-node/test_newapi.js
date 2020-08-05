    const snakeCaseKeys = require('snakecase-keys');
    // const { create: createKafka, TOPIC, PARTITION } = require('./kafkamq');
    // const Api = require('../lib/api.js');
    const fetch = require('node-fetch');
    const crypto = require('crypto')
    // const log = require('./src/lib/failedApi.js');
  

  async function call(body,signature)
  {
      const method = 'POST';
      const headers = { 'Content-Type': 'application/json' , 'signature': signature };
      console.log("body",body);
      console.log("headers",headers);
      const options = { method, body, headers };
      return await fetch("https://api-test.foresterx.com/api/wallet-notify",options) ;

  }

  const block ={hash:"000000000000000000147a7c7d848682df32f5c65e321f444ef7f18904f9a1f2",height:601629,balances_hash:[{currency:"BTC",address:"14ew3d8GYvf56qUVQUTe89LRSVWvsFx7Jo",transactionHash:"90aa9c6841b6bbbb1ec533a0aabd2a07f7df9eb2d293ec39abb851fc943ddc00",amount:"100356318"}],confirmed_network_txs:[]}
  // console.log("block",JSON.parse(block));
  // const snakeCaseBlock = snakeCaseKeys(block, { deep: true });
  const jsonBalancesHash = JSON.stringify(block);

  const body=jsonBalancesHash;
// const path="notify"; 
  hmac = crypto.createHmac('sha256', 'XYOcxRhEKlmVm0pC');
  hmac.update(body);
  hash = hmac.digest('hex');
  console.log("Method 2: ", hash);
  const signature = hash;
  // const logApi = new log(db);

  try{ 
    call(body,signature).then(block=>{block.json().then(result => console.log("result",result)
      )})
    // console.log("block" ,block);
    console.log("dupc r nha");
  }catch(errr){
      const method = 'POST';
      const headers = { 'Content-Type': 'application/json'  };
      // console.log("body",body);
      const body = JSON.stringify({service : "BTC", body : block , err : errr});
      console.log("headers",headers);
      const options = { method, body, headers };
      fetch("http://localhost/catch_log_api",options).then(result => console.log(result)) ;
    
    // logApi.update(block.currency,jsonBalancesHash,errr);
    console.log("loi ",errr);
    console.log("body" ,body);
  };