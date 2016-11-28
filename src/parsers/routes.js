"use strict";

const assert = require('assert');
const _ = require('lodash');
const util = require('util');
const utils = require('../utils');

module.exports = function (server, config) {

	_.forEach(config, route => {
		if (_.isArray(route)) {
			register(...route);
		} else if (_.isObject(route)) {
			_.forEach(route, (v, k) => {
				if (_.isArray(v) || _.isString(v)) {
					register(k, v);
				} else if (_.isObject(v) && v.backend) {
					register(k, v.backend || v.backends, _.omit(v, ['backend', 'backends']));
				} else {
					throw new Error(util.format('Invalid route {%s: %j}', k, v));
				}
			});
		} else {
			throw new Error(util.format('Invalid route %j', route));
		}
	});

	function register(source, targets, options) {
		assert(source, 'source is required');
		assert(targets, 'target is required');
		_.forEach(utils.sureArray(targets), target => server.register(source, target, options));
	}

};
