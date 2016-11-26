"use strict";

const program = require('commander');
const proxy = require('./proxy');

module.exports = function () {
	program
		.version(require('../package').version)
		.usage('[options]')
		.option('-c, --config', 'configuration file specifying');

	program.parse(process.argv);

	run(program)
};

function run(options) {
	options = options || {};
	return proxy(options.config, options);
}
