"use strict";

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

const loaders = {};

exports.yaml = loaders.yaml = require('./yaml');
exports.json = loaders.json = require('./json');

exports.extensions = _.transform(loaders, (result, loader, name) => {
	let extensions = loader.extensions || name;
	if (!Array.isArray(extensions)) extensions = [extensions];
	_(extensions).map(ext => ext[0] === '.' ? ext.substr(1) : ext).forEach(ext => result[ext] = loader);
}, {});

exports.load = function (file, context) {
	const ext = path.extname(file).substr(1);
	const loader = exports.extensions[ext];
	const template = Handlebars.compile(fs.readFileSync(file, 'utf8'));
	return loader.load(template(context));
};
