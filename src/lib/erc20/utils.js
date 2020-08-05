const { keccak256: sha3 } = require('js-sha3');

const padLeft = (raw, width, pos = '0') => {
  const data = String(raw);
  return data.length >= width
    ? data
    : new Array((width - data.length) + 1).join(pos) + data;
};

const getObject = (to, func, args = []) => {
  const funcHex = `0x${sha3(func).substring(0, 8)}`;
  const val = args.reduce((prev, arg) => prev + padLeft(arg, 64), '');
  const data = funcHex + val;
  return { to, data };
};

module.exports = { padLeft, getObject };
