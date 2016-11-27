'use strict';

const assert = require('assert');
const _ = require('lodash');
const util = require('util');
const Reverser = require('./reverser');
const Configure = require('./configure');
const utils = require('./utils');

module.exports = (file, options) => {

	if (typeof file === 'object') {
		options = file;
		file = null;
	}

	const config = file ? Configure('evoxy').load(file) : {};

	options = _.merge({
		port: 8080
	}, config, options);

	console.log('-----------');
	console.log(util.inspect(options, {colors: true, depth: null}));
	console.log('-----------');

	const {routes} = options;
	delete options['routes'];

	const reverser = new Reverser(options);

	_.forEach(routes, route => {
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
		_.forEach(utils.sureArray(targets), target => reverser.register(source, target, options));
	}

	return reverser;
};

