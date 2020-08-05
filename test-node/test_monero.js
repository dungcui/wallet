    

    
    // /const constants = require('./neo_constants');
    const HdKey = require('hdkey');
    const Neon = require("@cityofzion/neon-js");
    
    const hdPubKey = HdKey.fromExtendedKey("xprv9s21ZrQH143K3bL8T4MzHveBVVA5AZ976XqF6YxhQxoXX8hfQfbLf8Q2GqBmUx9bem7gf5S6MXSF8ita6RQPE4pahaPBacKeyGMSQLSsrfK");
    const path = "m/0/1";
    const { publicKey } = hdPubKey.derive(path);
    const { privateKey } = hdPubKey.derive(path);
    console.log("hdPubKey",hdPubKey.hdPublicKey
    );

    console.log("publicKey1",publicKey.toString('hex'));
    console.log("privateKey1",privateKey.toString('hex'));

    const ScriptHash = Neon.wallet.getScriptHashFromPublicKey(publicKey.toString('hex'));
    const address = Neon.wallet.getAddressFromScriptHash(ScriptHash);
    console.log('address1',address);
    //return {address};
    //publicKey 03a903f803244c556fd7393ee8b00395cf94379962698ae5510c62d25b03603dcc
    // address AH7uA85u4QS5rY5wfA4LdCAHCxDaEgL5zd
    //


    ///hd private key: <HDPrivateKey: xprv9s21ZrQH143K3bL8T4MzHveBVVA5AZ976XqF6YxhQxoXX8hfQfbLf8Q2GqBmUx9bem7gf5S6MXSF8ita6RQPE4pahaPBacKeyGMSQLSsrfK>
    ///hd public key: <HDPublicKey: xpub661MyMwAqRbcG5QbZ5tzf4av3WzZa1rxTkkqtwNJyJLWPw2oxCubCviW87PXixvjJM377xUThbyuADq3fjj7ADzHLdgdVS8SsnoQaVEHSAX></HDPublicKey>
    const {  api, wallet, tx, rpc } = require("@cityofzion/neon-js");

    const neoscan = new api.neoscan.instance(
    "https://neoscan-testnet.io/api/main_net"
    );
    const rpcNodeUrl = "http://seed2.neo.org:20332";
    const hdPubKey_private = HdKey.fromExtendedKey("xprv9s21ZrQH143K3bL8T4MzHveBVVA5AZ976XqF6YxhQxoXX8hfQfbLf8Q2GqBmUx9bem7gf5S6MXSF8ita6RQPE4pahaPBacKeyGMSQLSsrfK");

    const { privateKey:privateKey3 } = hdPubKey.derive("m/0/1");
    const { publicKey:publicKey2 } = hdPubKey_private.derive(path);

    // console.log("privateKey" ,privateKey.toString('hex') ,publicKey2.toString('hex'));
    const publicKey3 = wallet.getPublicKeyFromPrivateKey(privateKey3.toString('hex'));
    const scriptHash2 = wallet.getScriptHashFromPublicKey(publicKey3);
    const address4 = new wallet.Account("02b169cf47da08bf6bc3c9e927b16d016cf4f5af5c4d500b4d73737a09e2747a")
    console.log("aaA",wallet.getPublicKeyUnencoded(publicKey3.toString('hex'))) ;
    console.log("aaA2",wallet.getPublicKeyEncoded(wallet.getPublicKeyUnencoded(publicKey3.toString('hex')))) ;
    // wallet.Account[1]

    console.log(address4);
    // console.log(wallet.isPublicKey("0375ee29615c761c74950a6decc5c7b5408b5728e021d025e5bcbe5aba170c8869"));
    // wallet.Wallet
    
    //   console.log(keyA.privateKey);

