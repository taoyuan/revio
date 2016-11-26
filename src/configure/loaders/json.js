"use strict";

const fs = require('fs');
const JSON5 = require('json5');

exports.load = function (content) {
	return JSON5.parse(content);
};

exports.extensions = ['json', 'json5'];
