"use strict";

var crypto, EventEmitter, mysql;

// Node modules, used for injection
crypto = require("crypto");
EventEmitter = require("events");
mysql = require("node-mysql");

module.exports = require("./ddq-backend")(crypto, EventEmitter, mysql);
