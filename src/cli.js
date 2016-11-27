"use strict";

const _ = require('lodash');
const PromiseA = require('bluebird');
const program = require('commander');
const evoxy = require('./evoxy');

module.exports = function (argv) {

	const doRun = run(program);

	return new PromiseA(resolve => {
		let runned;

		program
			.version(require('../package').version)
			.usage('[options]')
			.option('-c, --config <file>', 'configuration file specifying')
			.option('-p --port', 'http port');

		program
			.command('install')
			.alias('i')
			.description('install some necessary files to system')
			.action(() => {
				runned = true;
				resolve(require('../scripts/install'));
			});

		program.parse(argv);

		if (!runned) {
			resolve(doRun());
		}
	});
};

function run(program) {
	return function () {
		const keys = _(program.options)
			.filter(o => o.long)
			.map(o => _.replace(o.long, /^[-]*/, ''))
			.filter(key => !['help', 'version'].includes(key) && !_.isFunction(program[key]))
			.value();
		const options = _.pick(program, keys);

		return evoxy(options.config, _.omit(options, 'config'));
	}
}
