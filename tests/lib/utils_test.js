const utils = require('../../src/utils');
const chai = require('chai');
const Decimal = require('decimal.js');

chai.should();
const { expect } = chai;

describe('utils', function () {
  describe('#formatAddressWithMemo', function () {
    it('should return address with memo text format', function () {
      const result = utils.formatAddressWithMemo({
        address: 'GCJKSAQECBGSLPQWAU7ME4LVQVZ6IDCNUA5NVTPPCUWZWBN5UBFMXZ53',
        memo: '86083097505824769',
      });
      result.should.equal('GCJKSAQECBGSLPQWAU7ME4LVQVZ6IDCNUA5NVTPPCUWZWBN5UBFMXZ53,memo_text:86083097505824769');
    });
  });

  describe('#nextId', function () {
    it('should return unique id', function () {
      const id1 = utils.nextId();
      const id2 = utils.nextId();
      id1.should.not.equal(id2);
    });
  });

  describe('#buildConfirmNetworkTxs', function () {
    it('should return list of network tx hash by currency', function () {
      const withdrawals = [
        { currency: 'XLM', transactionHash: 'f2d7a3f7fddea4ccf1b2e124e989461e05a8b1a915aab453d0a21a11af751070' },
        { currency: 'SIX', transactionHash: 'b4a255041549a5a39839530f2b6086d9768e339c842bd47d2957b3dfb07aec63' },
        { currency: 'SIX', transactionHash: '14541858ce2f37e29a60d468503a622c7eea18f06f3e325d49a9830c33ce822a' },
      ];
      const result = utils.buildConfirmNetworkTxs(withdrawals);
      result.XLM.length.should.equal(1);
      result.XLM.should.include('f2d7a3f7fddea4ccf1b2e124e989461e05a8b1a915aab453d0a21a11af751070');
      result.SIX.length.should.equal(2);
      result.SIX.should.include('b4a255041549a5a39839530f2b6086d9768e339c842bd47d2957b3dfb07aec63');
      result.SIX.should.include('14541858ce2f37e29a60d468503a622c7eea18f06f3e325d49a9830c33ce822a');
    });
  });

  describe('#buildBalancesHash', function () {
    it('should return balances hash by address then transaction', function () {
      const fundings = [
        { currency: 'XLM', toAddress: { fullAddress: 'GDFLJYMPORPYL4D2MXKXC3DMHSNTZGIK65R3TKXLW4OGZJ5LBE4ZAACN' }, amount: '9.0', transactionHash: 'f2d7a3f7fddea4ccf1b2e124e989461e05a8b1a915aab453d0a21a11af751070' },
        { currency: 'SIX', toAddress: { fullAddress: 'GCJKSAQECBGSLPQWAU7ME4LVQVZ6IDCNUA5NVTPPCUWZWBN5UBFMXZ53' }, amount: '7.123', transactionHash: 'b4a255041549a5a39839530f2b6086d9768e339c842bd47d2957b3dfb07aec63' },
        { currency: 'SIX', toAddress: { fullAddress: 'GCJKSAQECBGSLPQWAU7ME4LVQVZ6IDCNUA5NVTPPCUWZWBN5UBFMXZ53' }, amount: '532.34456', transactionHash: '14541858ce2f37e29a60d468503a622c7eea18f06f3e325d49a9830c33ce822a' },
        { currency: 'SIX', toAddress: { fullAddress: 'GCJKSAQECBGSLPQWAU7ME4LVQVZ6IDCNUA5NVTPPCUWZWBN5UBFMXZ53' }, amount: '678', transactionHash: '14541858ce2f37e29a60d468503a622c7eea18f06f3e325d49a9830c33ce822a' },
      ];
      const result = utils.buildBalancesHash(fundings);
      expect(new Decimal(result.XLM
        .GDFLJYMPORPYL4D2MXKXC3DMHSNTZGIK65R3TKXLW4OGZJ5LBE4ZAACN
        .f2d7a3f7fddea4ccf1b2e124e989461e05a8b1a915aab453d0a21a11af751070).equals(9.0)).to.be.true;
      expect(new Decimal(result.SIX
        .GCJKSAQECBGSLPQWAU7ME4LVQVZ6IDCNUA5NVTPPCUWZWBN5UBFMXZ53
        .b4a255041549a5a39839530f2b6086d9768e339c842bd47d2957b3dfb07aec63).equals(7.123)).to.be.true;
      expect(new Decimal(result.SIX
        .GCJKSAQECBGSLPQWAU7ME4LVQVZ6IDCNUA5NVTPPCUWZWBN5UBFMXZ53['14541858ce2f37e29a60d468503a622c7eea18f06f3e325d49a9830c33ce822a'])
        .equals(1210.34456)).to.be.true;
    });
  });
});
