    const { api, wallet, tx, rpc } = require("@cityofzion/neon-js");

    // const neoscan = new api.neoscan.instance(
    // "https://neoscan-testnet.io/api/main_net"
    // );
    // const rpcNodeUrl = "http://seed2.neo.org:20332";

    // neoscan.getBalance("AbArunq3PGYmQv4xhduTKva7r2ppUqeaDi").then(balance => console.log(balance))

    
    
    const HdKey = require('hdkey');
    const Neon = require("@cityofzion/neon-js");
    
    const hdPubKey = HdKey.fromExtendedKey("xprv9s21ZrQH143K3tYiNLXhcgJk1VqMwQNmiztH6vpnPZntae4Wn41YcAP643dueTjDsV2yCyAAn4bdSJaYiuyExKRhWNsTUJBUUnsm8YgMmBo");
    const path = "m/0/1";
    // const { publicKey } = hdPubKey.derive(path);
    const { privateKey } = hdPubKey.derive(path);
    console.log("hdkey",privateKey.toString('hex'));



    // console.log("publicKey1",publicKey.toString('hex'));
    // console.log("privateKey1",privateKey.toString('hex'));
    // const { ec : EC } = require("elliptic");
    // var ec = new EC('secp256k1');

    // const curve = new EC("p256");
    // const publicKeyBuffer=Buffer.from(publicKey, "hex");
    // const public = ec.keyFromPublic(publicKeyBuffer,"hex");
    // const x = public.getPublic().getX();
    // const y =  public.getPublic().getY();
    // console.log("x","y" ,x,y);
    // var pub = { x: x.toBuffer(), y: y.toBuffer() };
    // const publicp256= curve.keyFromPublic(pub,"hex");

    const address4 = new wallet.Account(privateKey.toString('hex'))
    console.log("address4",address4);
    // const publicKeyNepBuffer=Buffer.from(address4.publicKey, "hex");

    // const publicNeo = curve.keyFromPublic(publicKeyNepBuffer,"hex");
    // const xNeo = publicNeo.getPublic().getX();
    // const yNeo =  publicNeo.getPublic().getY();
    // console.log("x","y" ,x,y);
    // console.log("xNeo","yNeo" ,xNeo,yNeo);

    // var pub = { x: x.toBuffer(), y: y.toBuffer() };
    // const publicp256= curve.keyFromPublic(pub,"hex");


    // const unencodedPubKey = publicp256.getPublic().encode("hex");
    // console.log("unencodedPubKey",publicp256.getPublic().encode("hex"));
    // const tail = parseInt(unencodedPubKey.substr(64 * 2, 2), 16);
    // if (tail % 2 === 1) {
    //   console.log("03" + unencodedPubKey.substr(2, 64)) 
    // } else {
    //     console.log( "02" + unencodedPubKey.substr(2, 64)) 

      
    // }
//     const keypair = curve.keyFromPublic(publicKey,'hex');

//     const unencodedPubKey = keypair.getPublic().encode("hex");
//    console.log("unencodedPubKey",unencodedPubKey.toString('hex'));
//  curve.keyFromPublic

// export function getPublicKeyFromPrivateKey(
//     privateKey: string,
//     encode: boolean = true
//   ): string {
//     const privateKeyBuffer = Buffer.from(privateKey, "hex");
//     const keypair = curve.keyFromPrivate(privateKeyBuffer, "hex");
//     const unencodedPubKey = keypair.getPublic().encode("hex");
//     if (encode) {
//       const tail = parseInt(unencodedPubKey.substr(64 * 2, 2), 16);
//       if (tail % 2 === 1) {
//         return "03" + unencodedPubKey.substr(2, 64);
//       } else {
//         return "02" + unencodedPubKey.substr(2, 64);
//       }
//     } else {
//       return unencodedPubKey;
//     }
//   }