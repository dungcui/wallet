
const { keccak256: sha3 } = require('js-sha3');

let utils = require('ethereumjs-util');
let abi = require('ethereumjs-abi');
let _ = require('underscore');


const contractABI = [
    {
      constant: true,
      inputs: [],
      name: "name",
      outputs: [
        {
          name: "",
          type: "string"
        }
      ],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        {
          name: "spender",
          type: "address"
        },
        {
          name: "value",
          type: "uint256"
        }
      ],
      name: "approve",
      outputs: [
        {
          name: "",
          type: "bool"
        }
      ],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "totalSupply",
      outputs: [
        {
          name: "",
          type: "uint256"
        }
      ],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        {
          name: "from",
          type: "address"
        },
        {
          name: "to",
          type: "address"
        },
        {
          name: "value",
          type: "uint256"
        }
      ],
      name: "transferFrom",
      outputs: [
        {
          name: "",
          type: "bool"
        }
      ],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "decimals",
      outputs: [
        {
          name: "",
          type: "uint256"
        }
      ],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        {
          name: "spender",
          type: "address"
        },
        {
          name: "addedValue",
          type: "uint256"
        }
      ],
      name: "increaseAllowance",
      outputs: [
        {
          name: "success",
          type: "bool"
        }
      ],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: false,
      inputs: [],
      name: "unpause",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        {
          name: "value",
          type: "uint256"
        }
      ],
      name: "burn",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "paused",
      outputs: [
        {
          name: "",
          type: "bool"
        }
      ],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: true,
      inputs: [
        {
          name: "owner",
          type: "address"
        }
      ],
      name: "balanceOf",
      outputs: [
        {
          name: "",
          type: "uint256"
        }
      ],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [],
      name: "pause",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "owner",
      outputs: [
        {
          name: "",
          type: "address"
        }
      ],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "isOwner",
      outputs: [
        {
          name: "",
          type: "bool"
        }
      ],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "symbol",
      outputs: [
        {
          name: "",
          type: "string"
        }
      ],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        {
          name: "spender",
          type: "address"
        },
        {
          name: "subtractedValue",
          type: "uint256"
        }
      ],
      name: "decreaseAllowance",
      outputs: [
        {
          name: "success",
          type: "bool"
        }
      ],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        {
          name: "to",
          type: "address"
        },
        {
          name: "value",
          type: "uint256"
        }
      ],
      name: "transfer",
      outputs: [
        {
          name: "",
          type: "bool"
        }
      ],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [
        {
          name: "owner",
          type: "address"
        },
        {
          name: "spender",
          type: "address"
        }
      ],
      name: "allowance",
      outputs: [
        {
          name: "",
          type: "uint256"
        }
      ],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        {
          name: "newOwner",
          type: "address"
        }
      ],
      name: "transferOwnership",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [
        {
          name: "initialSupply",
          type: "uint256"
        },
        {
          name: "tokenName",
          type: "string"
        },
        {
          name: "decimalUnits",
          type: "uint256"
        },
        {
          name: "tokenSymbol",
          type: "string"
        }
      ],
      payable: false,
      stateMutability: "nonpayable",
      type: "constructor"
    },
    {
      anonymous: false,
      inputs: [],
      name: "Paused",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [],
      name: "Unpaused",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          name: "previousOwner",
          type: "address"
        },
        {
          indexed: true,
          name: "newOwner",
          type: "address"
        }
      ],
      name: "OwnershipTransferred",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          name: "from",
          type: "address"
        },
        {
          indexed: true,
          name: "to",
          type: "address"
        },
        {
          indexed: false,
          name: "value",
          type: "uint256"
        }
      ],
      name: "Transfer",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: true,
          name: "owner",
          type: "address"
        },
        {
          indexed: true,
          name: "spender",
          type: "address"
        },
        {
          indexed: false,
          name: "value",
          type: "uint256"
        }
      ],
      name: "Approval",
      type: "event"
    },
    {
      constant: false,
      inputs: [
        { name: "toAddress", type: "address" },
        { name: "value", type: "uint256" },
        { name: "tokenContractAddress", type: "address" },
        { name: "expireTime", type: "uint256" },
        { name: "sequenceId", type: "uint256" },
        { name: "signature", type: "bytes" }
      ],
      name: "sendMultiSigToken",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [{ name: "", type: "uint256" }],
      name: "signers",
      outputs: [{ name: "", type: "address" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        { name: "forwarderAddress", type: "address" },
        { name: "tokenContractAddress", type: "address" }
      ],
      name: "flushForwarderTokens",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: false,
      inputs: [
        { name: "toAddress", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "expireTime", type: "uint256" },
        { name: "sequenceId", type: "uint256" },
        { name: "signature", type: "bytes" }
      ],
      name: "sendMultiSig",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [{ name: "signer", type: "address" }],
      name: "isSigner",
      outputs: [{ name: "", type: "bool" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "getNextSequenceId",
      outputs: [{ name: "", type: "uint256" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [],
      name: "createForwarder",
      outputs: [{ name: "", type: "address" }],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      constant: true,
      inputs: [],
      name: "safeMode",
      outputs: [{ name: "", type: "bool" }],
      payable: false,
      stateMutability: "view",
      type: "function"
    },
    {
      constant: false,
      inputs: [],
      name: "activateSafeMode",
      outputs: [],
      payable: false,
      stateMutability: "nonpayable",
      type: "function"
    },
    {
      inputs: [{ name: "allowedSigners", type: "address[]" }],
      payable: false,
      stateMutability: "nonpayable",
      type: "constructor"
    },
    { payable: true, stateMutability: "payable", type: "fallback" },
    {
      anonymous: false,
      inputs: [
        { indexed: false, name: "from", type: "address" },
        { indexed: false, name: "value", type: "uint256" },
        { indexed: false, name: "data", type: "bytes" }
      ],
      name: "Deposited",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [{ indexed: false, name: "msgSender", type: "address" }],
      name: "SafeModeActivated",
      type: "event"
    },
    {
      anonymous: false,
      inputs: [
        { indexed: false, name: "msgSender", type: "address" },
        { indexed: false, name: "otherSigner", type: "address" },
        { indexed: false, name: "operation", type: "bytes32" },
        { indexed: false, name: "toAddress", type: "address" },
        { indexed: false, name: "value", type: "uint256" },
        { indexed: false, name: "data", type: "bytes" }
      ],
      name: "Transacted",
      type: "event"
    }
  ]
;

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

function isArray(type) {
    return type.lastIndexOf(']') === type.length - 1;
  }
  
  function getElementType(type) {
    const i = type.lastIndexOf('[');
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
    } else if (type.includes('bytes')) {
      const dataBuffer = Buffer.from(data, 'utf8');
      decodedData = dataBuffer.toString('hex');
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
    const constructor = _.findWhere(contractABI, { 'type': 'constructor'});
    const inputNames = _.pluck(constructor.inputs, 'name');
    const inputTypes = _.pluck(constructor.inputs, 'type');
    let decoded = abi.rawDecode(inputTypes, new Buffer(bytecode, 'hex'));
    let decodedArgs = _.map(decoded, function(e, i) {
      const data = formatSingle(inputTypes[i], e);
      return { 'name': inputNames[i], 'type': inputTypes[i], 'data': data };
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
    const inputTypes = _.pluck(inputs, 'type')
    const args = _.pluck(inputs, 'data')
    const encoded = abi.rawEncode(inputTypes, args);
    const bytecode = encoded.toString('hex');
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
    if(bytecode && bytecode.length>3)
    {
        // console.log("tao ne",bytecode.substring(1,bytecode.length))
        const argsBuffer = new Buffer(bytecode.substring(2,bytecode.length), 'hex');
        const methodID = argsBuffer.slice(0, 4);
        const argsData = argsBuffer.slice(4);
        const func = _.find(contractABI,  function(o) {
          if (o.type === 'function') {
            const inputTypes = _.pluck(o.inputs, 'type');
            return methodID.equals(abi.methodID(o.name, inputTypes));
          }
          return false;
        });
      
        if (!func) {
          return null;
        }
        console.log("func :",func);
      
        const inputNames = _.pluck(func.inputs, 'name');
        const inputTypes = _.pluck(func.inputs, 'type');
        let decoded = abi.rawDecode(inputTypes, argsData);
        let decodedArgs = _.map(decoded, function(e, i) {
          const data = formatSingle(inputTypes[i], e);
          return { 'name': inputNames[i], 'type': inputTypes[i], 'data': data };
        });
        decodedArgs.push({ function  : func.name});
        return decodedArgs;
    }else
    {
        return null;
    }
   
    
  }


  const decode  = decodeFunctionArgs(contractABI,"0x391252150000000000000000000000003052cd6bf951449a984fe4b5a38b46aef9455c8e000000000000000000000000000000000000000000000000f9ccd8a1c508000000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000005d145e33000000000000000000000000000000000000000000000000000000000000a13e00000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000041ad5f99fbab0a99207a92fa8bbad794b66d739067db3834195507c680fef58e911fdf017280e8eab7f44ceb17d3094f1f579b765820652f065caa84f1063f9a941c00000000000000000000000000000000000000000000000000000000000000");
  console.log("decode :",decode);
  console.log("size :",decode.length);