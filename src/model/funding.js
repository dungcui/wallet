const DbTable = require('./db_table');
const Decimal = require('decimal.js');

class Funding extends DbTable {
  constructor({ db, address }) {
    super(db, 'fundings');
    this.type = {
      FUNDING: 'funding',
      MOVE_FUND: 'move_fund',
      VIRTUAL: 'virtual',
    };
    this.state = {
      CONFIRMED: 'confirmed',
      PENDING: 'pending',
      FAILED: 'failed',
    };
    this.addresses = address;
  }

  async find(service, transactionHash, outputIndex, trx) {
    return this.createQuery(trx).where({ service, transactionHash, outputIndex }).first();
  }

  // git blame: Dang
  async findFundingByTxHashAndOutputIndex(service, transactionHash, outputIndex, type, trx) {
    return this
      .createQuery(trx)
      .where({
        service,
        transactionHash,
        outputIndex,
        type,
      })
      .first();
  }

   findAllUnspentByCurrency(currency, trx) {
    return this.createQuery(trx)
      .select(`${this.tableName}.*`)
      .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
      .where(`${this.tableName}.currency`, currency)
      .whereNull(`${this.tableName}.spentInTransactionHash`);
  }

   findAllUnspentByWalletIdAndCurrency(walletId, currency, trx) {
    return  this.findAllUnspentByCurrency(currency, trx)
      .where(`${this.addresses.tableName}.walletId`, walletId);
  }

  async findTopUnspentByWalletIdAndCurrency(walletId, currency, limit, trx) {
    return this.createQuery(trx)
      .select(`${this.tableName}.*`)
      .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
      .where(`${this.tableName}.currency`, currency)
      .whereNull(`${this.tableName}.spentInTransactionHash`)
      .where(`${this.addresses.tableName}.walletId`, walletId)
      .orderBy('amount', 'desc')
      .limit(limit);
    }

    async findTopUnspentByWalletIdAndCurrencyWithTypeWallets(walletId, currency, limit,isColdWallet, trx) {
      if(!isColdWallet)
      { 
        return this.createQuery(trx)
        .select(`${this.tableName}.*`)
        .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
        .where(`${this.tableName}.currency`, currency)
        .whereNull(`${this.tableName}.spentInTransactionHash`)
        .where(`${this.addresses.tableName}.walletId`, walletId)
        .whereNot(`${this.addresses.tableName}.type`, 'cold')
        .where(`${this.tableName}.unconfirmWithdraw`, '0')
        .orderBy('amount', 'desc')
        .limit(limit);
      } else {
        return this.createQuery(trx)
        .select(`${this.tableName}.*`)
        .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
        .where(`${this.tableName}.currency`, currency)
        .whereNull(`${this.tableName}.spentInTransactionHash`)
        .where(`${this.addresses.tableName}.walletId`, walletId)
        .where(`${this.addresses.tableName}.type`, 'cold')
        .where(`${this.tableName}.unconfirmWithdraw`, '0')
        .orderBy('amount', 'desc')
        .limit(limit);
      }
    }

    async findNewestUnspentByWalletIdAndCurrency(service, currency, limit, trx) {
      return this.createQuery(trx)
      .select(`${this.tableName}.*`)
      .whereNull(`${this.tableName}.spentInTransactionHash`)
      .where(`${this.tableName}.service`, service )
      .where(`${this.tableName}.currency`, currency )
      .orderBy('id', 'desc')
      .limit(limit);
    }

   findAllUnspentByAddressAndCurrency(address, currency, trx) {
    return  this.findAllUnspentByCurrency(currency, trx)
      .select(`${this.tableName}.*`)
      .where(`${this.addresses.tableName}.address`, address);
  }

  findAllUnspentByAddressAndCurrencyAndMaxInput(address, currency,limit, trx) {
    return  this.findAllUnspentByCurrency(currency, trx)
      .select(`${this.tableName}.*`)
      .where(`${this.addresses.tableName}.address`, address)
      .orderBy('amount', 'desc')
      .limit(limit);

  }



   async sumUnspentAmountByWalletIdAndCurrency(walletId, currency, trx) {
    const { total } = await this.createQuery(trx)
      .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
      .sum(`${this.tableName}.amount as total`)

      // Check currency and wallet
      .where(`${this.tableName}.currency`, currency)
      .where(`${this.addresses.tableName}.walletId`, walletId)

      // And not spent yet
      .whereNull(`${this.tableName}.spentInTransactionHash`)
      .first();

    return new Decimal(total || 0);
  }


  async sumUnspentAmountByWalletIdAndCurrencyWithTypeWallet(walletId, currency , isColdWallet, trx) {
    console.log("isColdWallet",isColdWallet);
    console.log("walletId",walletId);
    console.log("currency",currency);
    console.log("true,false : ",isColdWallet);
    if (!isColdWallet)
    {
      console.log("true : ",isColdWallet);
      const { total } = await this.createQuery(trx)
      .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
      .sum(`${this.tableName}.amount as total`)
      // Check currency and wallet
      .where(`${this.tableName}.currency`, currency)
      .where(`${this.addresses.tableName}.walletId`, walletId)
      .whereNot(`${this.addresses.tableName}.type`, 'cold')
      .where(`${this.tableName}.unconfirmWithdraw`, '0')

      // And not spent yet
      .whereNull(`${this.tableName}.spentInTransactionHash`)
      .first();
      console.log("total",total);
      return new Decimal(total || 0);
    } else {
      console.log("false : ",isColdWallet);

      const { total } = await this.createQuery(trx)
      .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
      .sum(`${this.tableName}.amount as total`)
      // Check currency and wallet
      .where(`${this.tableName}.currency`, currency)
      .where(`${this.addresses.tableName}.walletId`, walletId)
      .where(`${this.addresses.tableName}.type`, 'cold')
      .where(`${this.tableName}.unconfirmWithdraw`, '0')

      // And not spent yet
      .whereNull(`${this.tableName}.spentInTransactionHash`)
      .first();
      console.log("total",total);
      return new Decimal(total || 0);
    }

  }

  async sumTopUnspentAmountByWalletIdAndCurrency(walletId, currency, limit, trx) {
    const { total } = await this.createQuery(trx)
      .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
      .sum(`${this.tableName}.amount as total`)
      // Check currency and wallet
      .where(`${this.tableName}.currency`, currency)
      .where(`${this.addresses.tableName}.walletId`, walletId)
      // And not spent yet
      .whereNull(`${this.tableName}.spentInTransactionHash`)
      .orderby('amount desc')
      .limit(limit)
      .first();
    return new Decimal(total || 0);
  }

  async sumUnspentAmountByAddressAndCurrency(address, currency, trx) {
    const { total } = await this.createQuery(trx)
      .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
      .sum(`${this.tableName}.amount as total`)
      // Check currency and wallet
      .where(`${this.tableName}.currency`, currency)
      .where(`${this.addresses.tableName}.address`, address)
      // And not spent yet
      .whereNull(`${this.tableName}.spentInTransactionHash`)
      .first();
    return new Decimal(total || 0);
  }

  async sumUnspentAmountByAddressAndCurrencyAndTypeWallet(address, currency, type, trx) {
    const { total } = await this.createQuery(trx)
      .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
      .sum(`${this.tableName}.amount as total`)
      // Check currency and wallet
      .where(`${this.tableName}.currency`, currency)
      .where(`${this.addresses.tableName}.address`, address)
      .where(`${this.addresses.tableName}.type`, type)
      // And not spent yet
      .whereNull(`${this.tableName}.spentInTransactionHash`)
      .first();

    return new Decimal(total || 0);
  }



  findAllUnspentByWalletIdWithoutCurrencyForERC(walletId, trx) {
    return  this.findAllUnspentWithoutCurrencyForERC(trx)
      .where(`${this.addresses.tableName}.walletId`, walletId)

  }

  findAllUnspentWithoutCurrencyForERC(trx) {
    return this.createQuery(trx)
      .select(`${this.tableName}.*`)
      .innerJoin(`${this.addresses.tableName}`, 'addressId', `${this.addresses.tableName}.id`)
      .whereNot(`${this.tableName}.currency`, "ETHEREUM")
      .where(`${this.tableName}.service`, "ERC20")
      .whereNull(`${this.tableName}.spentInTransactionHash`);
  }

  async findAllUnspentMoveFundWithoutCurrencyForERC(wallet, trx) {
    return   this.findAllUnspentByWalletIdWithoutCurrencyForERC(wallet.id, trx)
      .select(`${this.addresses.tableName}.path as addressPath`)
      .whereNot(`${this.addresses.tableName}.address`, wallet.settlementAddress);
  }


  async findAllUnspentMoveFund(wallet, currency, trx) {
    return   this.findAllUnspentByWalletIdAndCurrency(wallet.id, currency, trx)
      .select(`${this.addresses.tableName}.path as addressPath`)
      .whereNot(`${this.addresses.tableName}.address`, wallet.settlementAddress);
  }

  async findAllUnspentFromSettlement(wallet, currency, trx) {
    return  this.findAllUnspentByWalletIdAndCurrency(wallet.id, currency, trx)
      .select(`${this.addresses.tableName}.path as addressPath`)
      .where(`${this.addresses.tableName}.address`, wallet.settlementAddress);
  }

  async add({
    service, transactionHash, outputIndex,
    type, blockHeight, amount, currency, addressId, script, state,
  }, trx) {
    await this.createQuery(trx).insert({
      service,
      transactionHash,
      outputIndex,
      type,
      blockHeight,
      amount,
      currency,
      addressId,
      script,
      state,
    });
  }

  async markAsSpent(id, spentInTransactionHash, trx) {
    await this.createQuery(trx)
      .where({ id })
      .update({
        spentInTransactionHash,
        updatedAt: this.db.fn.now(),
      });
  }

  async markUTXOAsSpent(service, transactionHash, outputIndex, spentInTransactionHash, trx) {
    await this.createQuery(trx)
      .where({ service, transactionHash, outputIndex })
      .update({
        spentInTransactionHash,
        updatedAt: this.db.fn.now(),
      });
  }

  async maskAsUnconfirmWithdraw(id, trx) {
    await this.createQuery(trx)
      .where({ id })
      .update({
        unconfirmWithdraw : '1' ,
        updatedAt: this.db.fn.now(),
      });
  }
}

module.exports = Funding;
