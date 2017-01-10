"use strict";

const Server = require('..').Server;
const expect = require('chai').expect;

const opts = {
	bunyan: false /* {
	 name: 'test',
	 streams: [{
	 path: '/dev/null',
	 }]
	 } */
};

describe("Route registration", function () {
	it("should register a simple route", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example.com', '192.168.1.2:8080');

		expect(server.routing).to.have.property("example.com");

		expect(server.resolve('example.com')).to.be.an("object");

		const host = server.routing["example.com"];
		expect(host).to.be.an("array");
		expect(host[0]).to.have.property('path');
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls).to.be.an('array');
		expect(host[0].urls.length).to.be.eql(1);
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.2:8080/');

		server.unregister('example.com', '192.168.1.2:8080');
		expect(server.resolve('example.com')).to.be.an("undefined");
		server.close();
	});

	it("should resolve domains as case insensitive", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example.com', '192.168.1.2:8080');

		const target = server.resolve('Example.com');
		expect(target).to.be.an("object");
		expect(target.urls[0].hostname).to.be.equal('192.168.1.2');

		server.close();
	});


	it("should register multiple routes", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example1.com', '192.168.1.2:8080');
		server.register('example2.com', '192.168.1.3:8081');
		server.register('example3.com', '192.168.1.4:8082');
		server.register('example4.com', '192.168.1.5:8083');
		server.register('example5.com', '192.168.1.6:8084');

		expect(server.routing).to.have.property("example1.com");
		expect(server.routing).to.have.property("example2.com");
		expect(server.routing).to.have.property("example3.com");
		expect(server.routing).to.have.property("example4.com");
		expect(server.routing).to.have.property("example5.com");

		let host;

		host = server.routing["example1.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.2:8080/');

		host = server.routing["example2.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.3:8081/');

		host = server.routing["example3.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.4:8082/');

		host = server.routing["example4.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.5:8083/');

		host = server.routing["example5.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.6:8084/');

		server.unregister('example1.com');
		expect(server.resolve('example1.com')).to.be.an("undefined");

		server.unregister('example2.com');
		expect(server.resolve('example2.com')).to.be.an("undefined");

		server.unregister('example3.com');
		expect(server.resolve('example3.com')).to.be.an("undefined");

		server.unregister('example4.com');
		expect(server.resolve('example4.com')).to.be.an("undefined");

		server.unregister('example5.com');
		expect(server.resolve('example5.com')).to.be.an("undefined");


		server.close();
	});

	it("should register several pathnames within a route", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example.com', '192.168.1.2:8080');
		server.register('example.com/qux/baz', '192.168.1.5:8080');
		server.register('example.com/foo', '192.168.1.3:8080');
		server.register('example.com/bar', '192.168.1.4:8080');

		expect(server.routing).to.have.property("example.com");

		const host = server.routing["example.com"];
		expect(host).to.be.an("array");
		expect(host[0]).to.have.property('path');
		expect(host[0].path).to.be.eql('/qux/baz');
		expect(host[0].urls).to.be.an('array');
		expect(host[0].urls.length).to.be.eql(1);
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.5:8080/');

		expect(host[0].path.length).to.be.least(host[1].path.length);
		expect(host[1].path.length).to.be.least(host[2].path.length);
		expect(host[2].path.length).to.be.least(host[3].path.length);

		server.unregister('example.com');
		expect(server.resolve('example.com')).to.be.an("undefined");

		expect(server.resolve('example.com', '/foo')).to.be.an("object");

		server.unregister('example.com/foo');
		expect(server.resolve('example.com', '/foo')).to.be.an("undefined");

		server.close();
	});

	it("shouldn't crash process in unregister of unregisted host", function (done) {
		const server = new Server(opts);

		server.unregister('example.com');

		done();

		server.close();
	})
});

describe("Route resolution", function () {
	it("should resolve to a correct route", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example.com', '192.168.1.2:8080');
		server.register('example.com/qux/baz', '192.168.1.5:8080');
		server.register('example.com/foo', '192.168.1.3:8080');
		server.register('example.com/bar', '192.168.1.4:8080');
		server.register('example.com/foo/baz', '192.168.1.3:8080');

		const route = server.resolve('example.com', '/foo/asd/1/2');
		expect(route.path).to.be.eql('/foo');
		expect(route.urls.length).to.be.eql(1);
		expect(route.urls[0].href).to.be.eql('http://192.168.1.3:8080/');

		server.close();
	});

	it("should resolve to a correct route with complex path", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example.com', '192.168.1.2:8080');
		server.register('example.com/qux/baz', '192.168.1.5:8080');
		server.register('example.com/foo', '192.168.1.3:8080');
		server.register('example.com/bar', '192.168.1.4:8080');
		server.register('example.com/foo/baz', '192.168.1.7:8080');

		const route = server.resolve('example.com', '/foo/baz/a/b/c');

		expect(route.path).to.be.eql('/foo/baz');
		expect(route.urls.length).to.be.eql(1);
		expect(route.urls[0].href).to.be.eql('http://192.168.1.7:8080/');

		server.close();
	});

	it("should resolve to undefined if route not available", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example.com', '192.168.1.2:8080');
		server.register('example.com/qux/baz', '192.168.1.5:8080');
		server.register('example.com/foo', '192.168.1.3:8080');
		server.register('foobar.com/bar', '192.168.1.4:8080');
		server.register('foobar.com/foo/baz', '192.168.1.3:8080');

		let route = server.resolve('wrong.com');
		expect(route).to.be.an('undefined');

		route = server.resolve('foobar.com');
		expect(route).to.be.an('undefined');

		server.close();
	});

	it("should get a target if route available", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example.com', '192.168.1.2:8080');
		server.register('example.com/qux/baz', '192.168.1.5:8080');
		server.register('example.com/foo', '192.168.1.3:8080');
		server.register('foobar.com/bar', '192.168.1.4:8080');
		server.register('foobar.com/foo/baz', '192.168.1.7:8080');
		server.register('foobar.com/media', '192.168.1.7:8080');

		let route = server.resolve('example.com', '/qux/a/b/c');
		expect(route.path).to.be.eql('/');

		route = server.resolve('foobar.com', '/medias/');
		expect(route).to.be.undefined;

		route = server.resolve('foobar.com', '/mediasa');
		expect(route).to.be.undefined;

		route = server.resolve('foobar.com', '/media/sa');
		expect(route.path).to.be.eql('/media');

		const target = server._getTarget('example.com', {url: '/foo/baz/a/b/c'});
		expect(target.href).to.be.eql('http://192.168.1.3:8080/')

		server.close();
	});

	it("should get a target with path when necessary", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example.com', '192.168.1.2:8080');
		server.register('example.com/qux/baz', '192.168.1.5:8080');
		server.register('example.com/foo', '192.168.1.3:8080/a/b');
		server.register('foobar.com/bar', '192.168.1.4:8080');
		server.register('foobar.com/foo/baz', '192.168.1.7:8080');

		const route = server.resolve('example.com', '/qux/a/b/c');
		expect(route.path).to.be.eql('/');

		const req = {url: '/foo/baz/a/b/c'};
		const target = server._getTarget('example.com', req);
		expect(target.href).to.be.eql('http://192.168.1.3:8080/a/b');
		expect(req.url).to.be.eql('/a/b/baz/a/b/c');

		server.close();
	})
});

describe("Wildcard hostname", function () {
	it("should resolve to a correct route", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('*.example.com/x', '192.168.1.2:8080');
		server.register('*.example.com/qux/baz', '192.168.1.5:8080');
		server.register('*.example.com/foo', '192.168.1.3:8080');
		server.register('*.foobar.com/bar', '192.168.1.4:8080');
		server.register('*.foobar.com/foo/baz', '192.168.1.3:8080');

		const route = server.resolve('www.foo.example.com', '/x/y/1/2');
		expect(route.path).to.be.eql('/x');
		expect(route.urls.length).to.be.eql(1);
		expect(route.urls[0].href).to.be.eql('http://192.168.1.2:8080/');

		server.close();
	});

	it("should resolve to undefined if route not available", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('*.example.com', '192.168.1.2:8080');
		server.register('*.example.com/qux/baz', '192.168.1.5:8080');
		server.register('*.example.com/foo', '192.168.1.3:8080');
		server.register('*.foobar.com/bar', '192.168.1.4:8080');
		server.register('*.foobar.com/foo/baz', '192.168.1.3:8080');

		let route = server.resolve('wrong.com');
		expect(route).to.be.an('undefined');

		route = server.resolve('foobar.com');
		expect(route).to.be.an('undefined');

		server.close();
	});
});

describe("TLS/SSL", function () {
	it("should allow TLS/SSL certificates", function () {
		const server = new Server({
			ssl: {
				port: 4430
			},
			bunyan: false
		});

		expect(server.routing).to.be.an("object");
		server.register('example.com', '192.168.1.1:8080', {
			ssl: {
				key: 'dummy',
				cert: 'dummy'
			}
		});

		server.register('example.com', '192.168.1.2:8080');

		expect(server.certs).to.be.an("object");
		// expect(server.certs['example.com']).to.be.an("object");
		expect(server.certs['example.com']).to.be.ok;

		server.unregister('example.com', '192.168.1.1:8080');
		expect(server.resolve('example.com')).to.not.be.an("undefined");
		expect(server.certs['example.com']).to.not.be.an("undefined");

		server.unregister('example.com', '192.168.1.2:8080');
		expect(server.resolve('example.com')).to.be.an("undefined");
		expect(server.certs['example.com']).to.be.an("undefined");
	});

	it('Should bind https servers to different ip addresses', function (testDone) {
		const isPortTaken = function (port, ip, done) {
			const net = require('net');
			const tester = net.createServer()
				.once('error', err => {
					if (err.code !== 'EADDRINUSE') return done(err);
					done(null, true)
				})
				.once('listening', () => {
					tester.once('close', () => {
						done(null, false)
					}).close()
				})
				.listen(port, ip)
		};

		const server = new Server({
			bunyan: false,
			port: 28080,

			// Specify filenames to default SSL certificates (in case SNI is not supported by the
			// user's browser)
			ssl: [
				{
					port: 4433,
					key: 'dummy',
					cert: 'dummy',
					ip: '127.0.0.1'
				},
				{
					port: 4434,
					key: 'dummy',
					cert: 'dummy',
					ip: '127.0.0.1'
				}
			]
		});

		server.register('mydomain.com', 'http://127.0.0.1:8001', {
			ssl: {
				key: 'dummy',
				cert: 'dummy',
				ca: 'dummym'
			}
		});

		let portsTaken = 0;
		let portsChecked = 0;

		function portsTakenDone(err, taken) {
			portsChecked++;
			if (err) {
				throw err;
			}
			if (taken) {
				portsTaken++;
			}
			if (portsChecked === 2) {
				portsCheckDone();
			}
		}

		function portsCheckDone() {
			expect(portsTaken).to.be.eql(2);
			server.close();
			testDone();
		}

		isPortTaken(4433, '127.0.0.1', portsTakenDone);
		isPortTaken(4434, '127.0.0.1', portsTakenDone);
	});
});


describe("Load balancing", function () {
	it("should load balance between several targets", function () {
		const server = new Server(opts);

		expect(server.routing).to.be.an("object");

		server.register('example.com', '192.168.1.1:8080');
		server.register('example.com', '192.168.1.2:8080');
		server.register('example.com', '192.168.1.3:8080');
		server.register('example.com', '192.168.1.4:8080');

		expect(server.routing['example.com'][0].urls.length).to.be.eql(4);
		expect(server.routing['example.com'][0].rr).to.be.eql(0);

		const route = server.resolve('example.com', '/foo/qux/a/b/c');
		expect(route.urls.length).to.be.eql(4);

		for (let i = 0; i < 1000; i++) {
			let target = server._getTarget('example.com', {url: '/a/b/c'});
			expect(target.href).to.be.eql('http://192.168.1.1:8080/');
			expect(server.routing['example.com'][0].rr).to.be.eql(1);

			target = server._getTarget('example.com', {url: '/x/y'});
			expect(target.href).to.be.eql('http://192.168.1.2:8080/');
			expect(server.routing['example.com'][0].rr).to.be.eql(2);

			target = server._getTarget('example.com', {url: '/j'});
			expect(target.href).to.be.eql('http://192.168.1.3:8080/');
			expect(server.routing['example.com'][0].rr).to.be.eql(3);

			target = server._getTarget('example.com', {url: '/k/'});
			expect(target.href).to.be.eql('http://192.168.1.4:8080/');
			expect(server.routing['example.com'][0].rr).to.be.eql(0);
		}

		server.unregister('example.com', '192.168.1.1:8080');
		expect(server.resolve('example.com')).to.not.be.an("undefined");

		server.unregister('example.com', '192.168.1.2:8080');
		expect(server.resolve('example.com')).to.not.be.an("undefined");

		server.unregister('example.com', '192.168.1.3:8080');
		expect(server.resolve('example.com')).to.not.be.an("undefined");

		server.unregister('example.com', '192.168.1.4:8080');
		expect(server.resolve('example.com')).to.be.an("undefined");

		server.close();
	});
});
