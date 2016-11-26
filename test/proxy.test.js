"use strict";

const assert = require('chai').assert;
const Proxy = require('../');

describe('proxy', () => {
	it('should create with empty config', () => {
		const proxy = Proxy();
		assert.ok(proxy);
	});

	it('should create with yaml config file', () => {
		const proxy = Proxy('test/fixtures/evoxy.yml');
		assert.isObject(proxy.routing);
		assert.property(proxy.routing, 'example.com');
		assert.ok(proxy);
	});
});
