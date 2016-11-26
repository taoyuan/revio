'use strict';

const _ = require('lodash');
const configure = require('./configure');
const validate = require('./validate');

module.exports = (config, options) => {

	if (typeof config === 'string') {
		config = configure.load(config);
	}

	options = _.merge({port: 8080}, config, options);

	validate(options);

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
