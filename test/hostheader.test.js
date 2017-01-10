"use strict";

const Server = require('..').Server;
const Promise = require('bluebird');
const http = require('http');
const expect = require('chai').expect;

const TEST_PORT = 54674;
const PROXY_PORT = 53433;

const opts = {
	port: PROXY_PORT,
	bunyan: false
};

describe("Target with a hostname", function () {

	it("Should have the host header passed to the target", function (done) {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('127.0.0.1', '127.0.0.1.xip.io:' + TEST_PORT, {
			useTargetHostHeader: true
		});

		expect(server.routing).to.have.property("127.0.0.1");

		testServer().then(function (req) {
			expect(req.headers['host']).to.be.eql('127.0.0.1.xip.io:' + TEST_PORT)
		});

		http.get('http://127.0.0.1:' + PROXY_PORT, function (res) {
			server.close();
			done();
		});
	});

	it("Should not have the host header passed to the target", function (done) {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('127.0.0.1', '127.0.0.1.xip.io:' + TEST_PORT);

		expect(server.routing).to.have.property("127.0.0.1");

		testServer().then(function (req) {
			expect(req.headers['host']).to.be.eql('127.0.0.1:' + PROXY_PORT)
		});

		http.get('http://127.0.0.1:' + PROXY_PORT, function (res) {
			server.close();
			done();
		});
	});

	it("Should return 404 after route is unregister", function (done) {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('127.0.0.1', '127.0.0.1.xip.io:' + TEST_PORT);
		server.unregister('127.0.0.1', '127.0.0.1.xip.io:' + TEST_PORT);

		expect(server.routing).to.have.property("127.0.0.1");

		testServer().then(function (req) {
			expect(req.headers['host']).to.be.eql('127.0.0.1:' + PROXY_PORT)
		});

		http.get('http://127.0.0.1:' + PROXY_PORT, function (res) {
			expect(res.statusCode).to.be.eql(404);

			server.close();
			done();
		});

	});

	it("Should return 502 after route with no backend", function (done) {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('127.0.0.1', '127.0.0.1.xip.io:502');

		expect(server.routing).to.have.property("127.0.0.1");

		http.get('http://127.0.0.1:' + PROXY_PORT, function (res) {
			expect(res.statusCode).to.be.eql(502);

			server.close();
			done();
		});
	});

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
