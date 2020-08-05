const { keccak256: sha3 } = require("js-sha3");

let utils = require("ethereumjs-util");
let abi = require("ethereumjs-abi");
let _ = require("underscore");

const padLeft = (raw, width, pos = "0") => {
  const data = String(raw);
  return data.length >= width
    ? data
    : new Array(width - data.length + 1).join(pos) + data;
};

const getObject = (to, func, args = []) => {
  const funcHex = `0x${sha3(func).substring(0, 8)}`;
  const val = args.reduce((prev, arg) => prev + padLeft(arg, 64), "");
  const data = funcHex + val;
  return { to, data };
};

function isArray(type) {
  return type.lastIndexOf("]") === type.length - 1;
}

function getElementType(type) {
  const i = type.lastIndexOf("[");
  return type.substring(0, i);
}

function formatSingle(type, data) {
  let decodedData;
  if (isArray(type)) {
    // TODO: handle each array appropriately
    const elementType = getElementType(type);
    decodedData = _.map(data, function(data) {
      return formatSingle(elementType, data);
    });
  } else if (type.includes("bytes")) {
    const dataBuffer = Buffer.from(data, "utf8");
    decodedData = dataBuffer.toString("hex");
  } else {
    decodedData = data.toString();
  }
  return decodedData;
}

/**
 * Decodes constructor args.
 *
 * @param {Object} contractABI - ABI of contract whose args to decode
 * @param {string} bytecode - Constructor args bytecode
 * @returns {Object} decodedArgs - Object representing decoded args with name, type, and data fields
 */
function decodeConstructorArgs(contractABI, bytecode) {
  const constructor = _.findWhere(contractABI, { type: "constructor" });
  const inputNames = _.pluck(constructor.inputs, "name");
  const inputTypes = _.pluck(constructor.inputs, "type");
  let decoded = abi.rawDecode(inputTypes, new Buffer(bytecode, "hex"));
  let decodedArgs = _.map(decoded, function(e, i) {
    const data = formatSingle(inputTypes[i], e);
    return { name: inputNames[i], type: inputTypes[i], data: data };
  });
  return decodedArgs;
}

/**
 * Generates constructor args bytecode based on input data.
 *
 * @param {Object[]} inputs - Array of objects with name, and type fields
 * @param {string} inputs[].name - Name of argument
 * @param {string} inputs[].type - Type of argument
 * @returns {string} bytecode - Constructor args bytecode
 */
function encodeConstructorArgs(inputs) {
  const inputTypes = _.pluck(inputs, "type");
  const args = _.pluck(inputs, "data");
  const encoded = abi.rawEncode(inputTypes, args);
  const bytecode = encoded.toString("hex");
  return bytecode;
}

/**
 * Decodes function args.
 *
 * @param {Object} contractABI - ABI of contract whose args to decode
 * @param {string} bytecode - full call args bytecode
 * @returns {Object} decodedArgs - Object representing decoded args with name, type, and data fields
 */
function decodeFunctionArgs(contractABI, bytecode) {
  if (bytecode && bytecode.length > 3) {
    // console.log("tao ne",bytecode.substring(1,bytecode.length))
    const argsBuffer = new Buffer(
      bytecode.substring(2, bytecode.length),
      "hex"
    );
    const methodID = argsBuffer.slice(0, 4);
    const argsData = argsBuffer.slice(4);
    const func = _.find(contractABI, function(o) {
      if (o.type === "function") {
        const inputTypes = _.pluck(o.inputs, "type");
        return methodID.equals(abi.methodID(o.name, inputTypes));
      }
      return false;
    });

    if (!func) {
      return null;
    }

    const inputNames = _.pluck(func.inputs, "name");
    const inputTypes = _.pluck(func.inputs, "type");
    let decoded = abi.rawDecode(inputTypes, argsData);
    let decodedArgs = _.map(decoded, function(e, i) {
      const data = formatSingle(inputTypes[i], e);
      return { name: inputNames[i], type: inputTypes[i], data: data };
    });
    decodedArgs.push({ function: func.name });
    return decodedArgs;
  } else {
    return null;
  }
}

module.exports = {
  padLeft,
  getObject,
  encodeConstructorArgs,
  decodeConstructorArgs,
  decodeFunctionArgs
};
