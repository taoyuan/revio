"use strict";

const assert = require('chai').assert;
const evoxy = require('..');

describe('evoxy', () => {
	it('should create with empty config', () => {
		const reverser = evoxy();
		assert.ok(reverser);
	});

	it('should create with yaml config file', () => {
		const reverser = evoxy('test/fixtures/evoxy.yml');
		assert.isObject(reverser.routing);
		assert.property(reverser.routing, 'example.com');
		assert.ok(reverser);
	});
});
