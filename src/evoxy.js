'use strict';

const assert = require('assert');
const _ = require('lodash');
const util = require('util');
const Server = require('./server');
const Configure = require('./configure');
const Logger = require('./logger');
const utils = require('./utils');
const parsers = require('./parsers');

module.exports = (file, options) => {

	if (typeof file === 'object') {
		options = file;
		file = null;
	}

	const config = Configure('evoxy').load(file);

	options = _.merge({
		server: {
			port: 8080
		}
	}, config, options);

	const serverOptions = options.server;

	const logger = serverOptions.bunyan || serverOptions.logger || {};
	logger.level = logger.level || (serverOptions.debug ? 'debug' : 'info');
	const log = Logger.get(logger);

	if (serverOptions.debug) {
		log.debug(serverOptions, 'Using configuration');
	}

	const server = new Server(serverOptions);

	_.forEach(options, (cfg, name) => {
		if (name === 'server') return;
		parsers.get(name)(server, cfg);
	});

	return server;
};

