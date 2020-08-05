const debug = require("debug")("wallet:server");
const _ = require("lodash");
const camelCaseKeys = require("camelcase-keys");
const express = require("express");
const bodyParser = require("body-parser");
var expressQueue = require("express-queue");
const queueMw = expressQueue({ activeLimit: 10, queuedLimit: -1 });
// const baseService = require('../lib/service.js');
const RESPONSE_DELAY = 10000;

function getCurrencyToService(services, tokens) {
  const hash = {};
  // Native currency
  services.forEach(service => {
    // console.log("service",service);
    // Backward compatible
    const currencies = service.currencies || [];
    // Native
    if (service.currency) {
      currencies.push(service.currency);
    }
    currencies.forEach(currency => {
      hash[currency] = service;
    });
  });
  tokens.forEach(t => {
    const service = services.find(s => s.name === t.service);
    if (!service) {
      throw Error(`Service ${t.service} not found`);
    }
    hash[t.currency] = service;
  });
  return hash;
}

async function create({ port, services, tokens }) {
  const currencyToService = getCurrencyToService(services, tokens);

  // Create server
  const server = express();

  let rawBody = "";
  function verifyRequest(req, res, buf, encoding) {
    // The raw body is contained in 'buf'
    rawBody = buf.toString(encoding);
  }
  server.use(bodyParser.json({ verify: verifyRequest }));
  // server.use(queueMw);
  server.get("/", (req, res) => {
    res.json({ message: "API portal" });
  });

  const handleRequest = (req, resp) => {
    var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    if (ip.substr(0, 7) == "::ffff:") {
      ip = ip.substr(7);
    }
    // if (ip !== "52.200.174.53") {
    //   resp.status(500).json({
    //     error: 500,
    //     message: "access deni from ip " + ip
    //   });
    //   return;
    // }

    const { url } = req;
    const headers = req.headers;
    // console.log("header",headers.signature);

    const option = { deep: true };
    const method = _.camelCase(url.slice(1));
    const { currency } = req.body;

    if (!currency) {
      resp.status(404).json({
        error: 404,
        message: "Missing currency!"
      });
      return;
    }
    const service = currencyToService[currency];
    if (!service) {
      resp.status(500).json({
        error: 500,
        message: "Currency is not support"
      });
      return;
    }
    try {
      // Convert from snake to camel...
      if (method === "withdrawCurrency") {
        service[method](rawBody, req.body, headers.signature)
          .then(res => {
            // Convert from camel back to snake
            setTimeout(function() {
              resp.json(res);
            }, RESPONSE_DELAY);
          })
          .catch(err => {
            // Print error for logging
            debug(err.stack);
            resp.status(500).json({ error: 500, message: err.message });
          });
      } else {
        service[method](camelCaseKeys(req.body, option))
          .then(res => {
            // Convert from camel back to snake
            resp.json(res);
          })
          .catch(err => {
            // Print error for logging
            debug(err.stack);
            resp.status(500).json({ error: 500, message: err.message });
          });
      }
    } catch (err) {
      console.log("err", err);
      resp.status(500).json({ error: 500, message: "undefined method" });
    }
  };

  const handleRequestNoCurrency = (req, resp) => {
    const { url } = req;
    const headers = req.headers;
    // console.log("header",headers.signature);
    const service = currencyToService["BTC"];
    const option = { deep: true };
    const method = _.camelCase(url.slice(1));
    try {
      service[method](camelCaseKeys(req.body, option))
        .then(res => {
          // Convert from camel back to snake
          resp.json(res);
        })
        .catch(err => {
          // Print error for logging
          debug(err.stack);
          resp.status(500).json({ error: 500, message: err.message });
        });
    } catch (err) {
      console.log("err", err);
      resp.status(500).json({ error: 500, message: "undefined method" });
    }
  };

  server.post("/catch_log_api", handleRequestNoCurrency);

  server.post("/withdraw_currency", handleRequest);

  // format "/get_total_balance?currency=xxx&wallet_id=1"
  server.get("/get_total_balance", (req, resp) => {
    const method = _.camelCase(req.path);
    const walletId = _.camelCase(req.query.wallet_id);
    const currency = req.query.currency;
    let isColdWallet = _.camelCase(req.query.isColdWallet);
    console.log("isColdWallet :", isColdWallet);
    if (isColdWallet === "") {
      isColdWallet = "true";
    }

    if (currency == "GGC") {
      resp.json({ currency: "GGC", totalBalance: "120" });
      return;
    }
    // resp.set('Content-Type', 'application/json');
    if (!currency) {
      resp.status(404).json({
        error: 404,
        message: "Missing currency!"
      });
      return;
    }
    const service = currencyToService[currency];
    if (!service) {
      resp.status(500).json({
        error: 500,
        message: "Currency is not support"
      });
      return;
    }
    try {
      // Convert from snake to camel...
      service[method](currency, walletId, isColdWallet)
        .then(res => {
          // Convert from camel back to snake
          resp.json(res);
        })
        .catch(err => {
          // Print error for logging
          debug(err.stack);
          resp.status(500).json({ error: 500, message: err.message });
        });
    } catch (err) {
      console.log("err", err);
      resp.status(500).json({ error: 500, message: "undefined method" });
    }
  });

  server.post("/validate_address", handleRequest);

  server.post("/add_wallet", handleRequest);

  server.post("/get_address", handleRequest);

  server.post("/bundle_transactions", handleRequest);

  server.post("/broadcast", handleRequest);

  server.post("/get_status", handleRequest);

  server.post("/add_contract_token", handleRequest);

  server.post("/decode_raw_transaction", handleRequest);

  server.post("/withdraw_currency", handleRequest);

  server.post("/update_limit", handleRequestNoCurrency);

  server.get("/get_limit", (req, resp) => {
    const method = _.camelCase(req.path);

    const service = currencyToService["BTC"];
    if (!service) {
      resp.status(500).json({
        error: 500,
        message: "Currency is not support"
      });
      return;
    }
    try {
      // Convert from snake to camel...
      service[method]()
        .then(res => {
          // Convert from camel back to snake
          resp.json(res);
        })
        .catch(err => {
          // Print error for logging
          debug(err.stack);
          resp.status(500).json({ error: 500, message: err.message });
        });
    } catch (err) {
      console.log("err", err);
      resp.status(500).json({ error: 500, message: "undefined method" });
    }
  });

  server.get("/get_lastest_block", (req, resp) => {
    const method = _.camelCase(req.path);
    // const walletId  = _.camelCase(req.query.wallet_id);
    const currency = req.query.currency;
    // resp.set('Content-Type', 'application/json');
    // console.log("currency",currency);
    const service = currencyToService[currency];
    if (!service) {
      resp.status(500).json({
        error: 500,
        message: "Currency is not support"
      });
      return;
    }
    try {
      // Convert from snake to camel...
      service[method](currency)
        .then(res => {
          // Convert from camel back to snake
          resp.json(res);
        })
        .catch(err => {
          // Print error for logging
          console.log("ERR", err);
          debug(err.stack);
          resp.status(500).json({ error: 500, message: err.message });
        });
    } catch (err) {
      console.log("ERR", err);
      resp.status(500).json({ error: 500, message: "undefined method" });
    }
  });

  // server.use(function(req, res, next) {
  //   res.status(404).send("Sorry, that route doesn't exist. Have a nice day :)");
  // });

  // server.addService(proto.WalletService.service, service);

  // Check whether dev or production
  // if (process.env.NODE_ENV === 'development') {
  // } else {
  // }

  const app = server.listen(port, () => {
    debug(`listen on port ${port}`);
  });
  return app;
}

module.exports = { create };
