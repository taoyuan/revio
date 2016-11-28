"use strict";

const util = require('util');
const chalk = require('chalk');

function find(name) {
	return resolveParser(name).parser;
}
exports.find = find;

function get(name) {
	const {parser, error} = resolveParser(name);
	if (error) throw new Error(error);
	return parser;
}
exports.get = get;

// List possible parser module names
function parserModuleNames(name) {
	const names = []; // Check the name as is
	if (!name.match(/^\//)) {
		names.push('./parsers/' + name); // Check built-in parsers
		if (name.indexOf('evoxy-parser-') !== 0) {
			names.push('evoxy-parser-' + name); // Try evoxy-parser-<name>
		}
	}
	return names;
}

// testable with DI
function tryModules(names, loader) {
	let mod;
	loader = loader || require;
	for (let m = 0; m < names.length; m++) {
		try {
			mod = loader(names[m]);
		} catch (e) {
			/* ignore */
		}
		if (mod) {
			break;
		}
	}
	return mod;
}

const NOT_FOUND = `
WARNING: Evoxy parser "${chalk.blue('%s')}" is not installed as any of the following modules:
		 
${chalk.green('%s')}
		 
To fix, run:
		 
    ${chalk.blue('npm install %s --save')}
`;

/*!
 * Resolve a parser by name
 * @param name The parser name
 * @returns {*}
 * @private
 */
function resolveParser(name, loader) {
	const names = parserModuleNames(name);
	const parser = tryModules(names, loader);
	let error = null;
	if (!parser) {
		error = util.format(NOT_FOUND, name, names.join('\n'), names[names.length - 1]);
	}
	return {
		parser: parser,
		error: error,
	};
}
