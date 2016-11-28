"use strict";

const assert = require('chai').assert;
const utils = require('../src/utils');

const urlparse = require('url').parse;

describe('utils', () => {
	it('should prepare url', () => {
		const url0 = utils.prepareUrl('www.example.com');
		const url1 = urlparse('http://www.example.com');
		assert.equal(url0.href, url1.href);
	});
});
