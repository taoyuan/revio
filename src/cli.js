"use strict";

const _ = require('lodash');
const program = require('commander');
const evoxy = require('./evoxy');

module.exports = function () {
	program
		.version(require('../package').version)
		.usage('[options]')
		.option('-c, --config <file>', 'configuration file specifying')
		.option('-p --port', 'http port');

	program.parse(process.argv);

	const keys = _(program.options)
		.filter(o => o.long)
		.map(o => _.replace(o.long, /^[-]*/, ''))
		.filter(key => !['help', 'version'].includes(key) && !_.isFunction(program[key]))
		.value();

	run(_.pick(program, keys));
};

function run(options) {
	options = options || {};
	return evoxy(options.config, _.omit(options, 'config'));
}
