"use strict";

const assert = require('chai').assert;
const home = require('os-homedir')();
const configure = require('../').Configure('revio');

describe('configure', () => {

	describe('find', () => {

		it('should find config file', () => {
			const file = configure.find('test/fixtures/revio.+(yml|yaml|json|json5)');
			assert.ok(file);
		});

		it('should return undefined for un exist config file', () => {
			const file = configure.find('test/fixtures/revio.+(js)');
			assert.isUndefined(file);
		});
	});

	describe('possibles', () => {
		it('should get proper possibles without file specified', () => {
			const possibles = configure.possibles();
			assert.deepEqual(possibles, [
				'./revio.+(yml|yaml|json|json5)',
				home + '/revio/revio.+(yml|yaml|json|json5)',
				'/etc/revio/revio.+(yml|yaml|json|json5)'
			]);
		});

		it('should get proper possibles with file specified', () => {
			const possibles = configure.possibles('./revio.yml');
			assert.deepEqual(possibles, ['./revio.yml']);
		});
	});

	describe('load', () => {
		it('should load config with specified', () => {
			let config;
			config = configure.load('test/fixtures/revio.yml');
			assert.ok(config.server);
			assert.equal(config.server.port, 9000);

			config = configure.load('test/fixtures/revio.json');
			assert.ok(config.server);
			assert.equal(config.server.port, 9001);
		});
	});

});
