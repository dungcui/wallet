const contractABI = {
  abi: [
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
};

module.exports = contractABI;
