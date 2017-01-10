"use strict";

const _ = require('lodash');
const bunyan = require('bunyan');

const LOG_LEVELS = ['trace', 'debug', 'info', 'error', 'fatal'];

exports.create = function (options) {
	options = Object.assign({name: 'revio'}, options);
	return bunyan.createLogger(options);
};

exports.get = function (options) {
	if (_.isObject(options)) {
		if ((options instanceof bunyan)
			|| (_.isFunction(options.debug) && _.isFunction(options.info) && _.isFunction(options.error))) {
			return options;
		}
	}

	return exports.create(options);
};

exports.noop = _.transform(LOG_LEVELS, (result, key) => result[key] = _.noop, {});
