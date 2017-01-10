"use strict";

const assert = require('chai').assert;
const revio = require('..');

describe('revio', () => {
	it('should create with empty config', () => {
		const server = revio();
		assert.ok(server);
	});

	it('should create with yaml config file', () => {
		const server = revio('test/fixtures/revio.yml');
		assert.isObject(server.routing);
		assert.property(server.routing, 'example.com');
		assert.ok(server);
	});
});
