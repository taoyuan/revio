"use strict";

const assert = require('chai').assert;
const evoxy = require('..');

describe('evoxy', () => {
	it('should create with empty config', () => {
		const server = evoxy();
		assert.ok(server);
	});

	it('should create with yaml config file', () => {
		const server = evoxy('test/fixtures/evoxy.yml');
		assert.isObject(server.routing);
		assert.property(server.routing, 'example.com');
		assert.ok(server);
	});
});
