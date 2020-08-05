const conseiljs = require('conseiljs');

async function createAccount() {
    const mnemonic = conseiljs.TezosWalletUtil.generateMnemonic();
    console.log(`mnemonic: ${mnemonic}`);
    const keystore = await conseiljs.TezosWalletUtil.unlockIdentityWithMnemonic(mnemonic, '');
    console.log(`account id: ${keystore.publicKeyHash}`);
    console.log(`public key: ${keystore.publicKey}`);
    console.log(`secret key: ${keystore.privateKey}`);
}

createAccount();