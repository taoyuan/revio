"use strict";

const Configure = require('./configure');
const Server = require('./server');
const Docker = require('./docker');

exports = module.exports = require('./revio');

exports.Configure = Configure;
exports.Server = Server;
exports.Docker = Docker;

exports.server = () => new Server(...arguments);
exports.docker = () => new Docker(...arguments);
