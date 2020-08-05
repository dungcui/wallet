module.exports = {
    // Global
    NAME: 'COSMOS',
    CURRENCY: 'ATOM',
    FEE_CURRENCY: 'uatom',
    TYPE_TRANSACTION: 'cosmos-sdk/MsgSend',
    CHAIN_ID: 'cosmoshub-3',


    // Local
    // 1 Atom = 1.000.000 Uatom
    ATOM_TO_UATOM: 1000000,
    // UATOM
    BASE_FEE: 5000,
    BASE_GAS: 200000,
    FEE: { amount: [{ amount: String(5000), denom: "uatom" }], gas: String(200000) }

};
