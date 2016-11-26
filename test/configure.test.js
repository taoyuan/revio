"use strict";

const assert = require('chai').assert;
const configure = require('../').configure;

const home = require('os-homedir')();

describe('configure', () => {

	describe('find', () => {

		it('should find config file', () => {
			const file = configure.find('test/fixtures/evoxy.+(yml|yaml|json|json5)');
			assert.ok(file);
		});

		it('should return undefined for un exist config file', () => {
			const file = configure.find('test/fixtures/evoxy.+(js)');
			assert.isUndefined(file);
		});
	});

	describe('possibles', () => {
		it('should get proper possibles without file specified', () => {
			const possibles = configure.possibles();
			assert.deepEqual(possibles, [
				'./evoxy.+(yml|yaml|json|json5)',
				home + '/evoxy/evoxy.+(yml|yaml|json|json5)',
				'/etc/evoxy/evoxy.+(yml|yaml|json|json5)'
			]);
		});

		it('should get proper possibles with file specified', () => {
			const possibles = configure.possibles('./evoxy.yml');
			assert.deepEqual(possibles, ['./evoxy.yml']);
		});
	});

	describe('load', () => {
		it('should load config with specified', () => {
			let config = configure.load('test/fixtures/evoxy.yml');
			assert.ok(config);
			assert.equal(config.port, 9000);

			config = configure.load('test/fixtures/evoxy.json');
			assert.ok(config);
			assert.equal(config.port, 9001);
		});
	});

});