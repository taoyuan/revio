"use strict";

const _ = require('lodash');
const path = require('path');
const glob = require('glob');
const loaders = require('./loaders');

const home = require('os-homedir')();

class Configure {

	constructor(appname) {
		this.appname = appname;
	}

	possibles(file) {

		const exts = Object.keys(loaders.extensions).join('|');
		const filename = `${this.appname}.+(${exts})`;
		return file ? [file] : [
			`./${filename}`,
			path.resolve(home, this.appname, filename),
			path.resolve('/etc', this.appname, filename),
		];
	}

	load(file, options) {
		if (!_.isString(file)) {
			options = file;
			file = undefined;
		}
		const possibles = this.possibles(file);
		const f = this.find(possibles, options);
		if (!f) {
			console.log('[evoxy] No config file found from');
			possibles.map(p => console.log('  ' + p));
			return {};
		}
		console.log('[evoxy] Loading config from file:', f);
		const ccd = path.dirname(f);
		return loaders.load(f, {home, ccd, base: ccd});
	}

	find(possibles, options) {
		if (typeof possibles === 'string') {
			possibles = [possibles];
		}
		let found = undefined;
		_(possibles).filter(p => !!p).forEach(p => {
			if (!p) return;
			const files = glob.sync(p, options);
			if (!_.isEmpty(files)) {
				found = files[0];
				return false;
			}
		});
		return found;
	}
}

exports = module.exports = name => new Configure(name);
exports.Configure = Configure;
