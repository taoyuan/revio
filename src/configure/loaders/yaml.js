"use strict";

const fs = require('fs');
const yaml = require('js-yaml');

exports.load = function (content) {
	return yaml.safeLoad(content);
};

exports.extensions = ['yml', 'yaml'];
