"use strict";

const Reverser = require('..').Reverser;
const Promise = require('bluebird');
const http = require('http');
const expect = require('chai').expect;

const TEST_PORT = 54673;
const PROXY_PORT = 53432;

const opts = {
	port: PROXY_PORT,
	bunyan: false /* {
	 name: 'test',
	 streams: [{
	 path: '/dev/null',
	 }]
	 } */
};

describe("Target with pathnames", function () {

	it("Should be proxyed to target with pathname and source pathname concatenated", function (done) {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('127.0.0.1', '127.0.0.1:' + TEST_PORT + '/foo/bar/qux');

		expect(reverser.routing).to.have.property("127.0.0.1");

		testServer().then(function (req) {
			expect(req.url).to.be.eql('/foo/bar/qux/a/b/c')
		});

		http.get('http://127.0.0.1:' + PROXY_PORT + '/a/b/c', function (res) {
			reverser.close();
			done();
		});

	});

	it("Should be proxyed to target with pathname and source pathname concatenated case 2", function (done) {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('127.0.0.1/path', '127.0.0.1:' + TEST_PORT + '/foo/bar/qux');

		expect(reverser.routing).to.have.property("127.0.0.1");

		testServer().then(function (req) {
			expect(req.url).to.be.eql('/foo/bar/qux/a/b/c')
		});

		http.get('http://127.0.0.1:' + PROXY_PORT + '/path/a/b/c', function (err, res) {
			reverser.close();
			done();
		});

	})
});


function testServer() {
	return new Promise(function (resolve, reject) {
		const server = http.createServer(function (req, res) {
			res.write("");
			res.end();
			resolve(req);
			server.close();
		});
		server.listen(TEST_PORT);
	})
}
