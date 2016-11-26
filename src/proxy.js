'use strict';

const _ = require('lodash');
const util = require('util');
const configure = require('./configure');
const validate = require('./validate');

module.exports = (file, options) => {

	if (typeof file === 'object') {
		options = file;
		file = null;
	}

	const config = configure.load(file);

	options = _.merge({
		port: 8080
	}, config, options);

	validate(options);

	console.log('-----------');
	console.log(util.inspect(options, {colors: true, depth: null}));
	console.log('-----------');

	const {routes} = options;

	delete options['routes'];

	const proxy = require('redbird')(options);

	_.forEach(routes, route => {
		const source = route[0];
		let targets = route[1];
		const options = route[2];
		if (!Array.isArray(targets)) {
			targets = [targets];
		}
		_.forEach(targets, target => proxy.register(source, target, options));
	});

	return proxy;
};
