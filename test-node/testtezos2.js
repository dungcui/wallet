const conseiljs = require('conseiljs');
const tezosNode = 'https://tezos-dev.cryptonomic-infra.tech:443';

async function activateAccount() {
    const keystore = {
        publicKey: "edpktxEuQFHMzsTtnxMXSMxDGg9FWBDryLGyQBmhJo9GdU27HNkZVe",
        privateKey: "edskS5YDx11JSsxePQt7gar8owuBEm6p6FByRbWm6EhD8H7CF11YeMSabnW6TUkQ7cau6ncUpDYrnFJ3VsgZViVBkgSDgjK6zu",
        publicKeyHash: "tz1ftbjB8bVGWLrYNm5kPEdSAWYqbj2SAK82",
        seed: '',
        storeType: conseiljs.StoreType.Fundraiser
    };
    const result = await conseiljs.TezosNodeWriter.sendIdentityActivationOperation(tezosNode, keystore, '96391f810cbe7d0a7dd4ed851f7fb20e3c5bc723');
    console.log(`Injected operation group id ${result.operationGroupID}`)
}

activateAccount();