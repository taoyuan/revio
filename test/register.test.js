"use strict";

const Reverser = require('..').Reverser;
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
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example.com', '192.168.1.2:8080');

		expect(reverser.routing).to.have.property("example.com")

		expect(reverser.resolve('example.com')).to.be.an("object");

		const host = reverser.routing["example.com"];
		expect(host).to.be.an("array");
		expect(host[0]).to.have.property('path')
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls).to.be.an('array');
		expect(host[0].urls.length).to.be.eql(1);
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.2:8080/');

		reverser.unregister('example.com', '192.168.1.2:8080');
		expect(reverser.resolve('example.com')).to.be.an("undefined")
		reverser.close();
	});

	it("should resolve domains as case insensitive", function () {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example.com', '192.168.1.2:8080');

		const target = reverser.resolve('Example.com');
		expect(target).to.be.an("object");
		expect(target.urls[0].hostname).to.be.equal('192.168.1.2');

		reverser.close();
	});


	it("should register multiple routes", function () {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example1.com', '192.168.1.2:8080');
		reverser.register('example2.com', '192.168.1.3:8081');
		reverser.register('example3.com', '192.168.1.4:8082');
		reverser.register('example4.com', '192.168.1.5:8083');
		reverser.register('example5.com', '192.168.1.6:8084');

		expect(reverser.routing).to.have.property("example1.com");
		expect(reverser.routing).to.have.property("example2.com");
		expect(reverser.routing).to.have.property("example3.com");
		expect(reverser.routing).to.have.property("example4.com");
		expect(reverser.routing).to.have.property("example5.com");

		let host;

		host = reverser.routing["example1.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.2:8080/');

		host = reverser.routing["example2.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.3:8081/');

		host = reverser.routing["example3.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.4:8082/');

		host = reverser.routing["example4.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.5:8083/');

		host = reverser.routing["example5.com"];
		expect(host[0].path).to.be.eql('/');
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.6:8084/');

		reverser.unregister('example1.com');
		expect(reverser.resolve('example1.com')).to.be.an("undefined")

		reverser.unregister('example2.com');
		expect(reverser.resolve('example2.com')).to.be.an("undefined")

		reverser.unregister('example3.com');
		expect(reverser.resolve('example3.com')).to.be.an("undefined")

		reverser.unregister('example4.com');
		expect(reverser.resolve('example4.com')).to.be.an("undefined")

		reverser.unregister('example5.com');
		expect(reverser.resolve('example5.com')).to.be.an("undefined")


		reverser.close();
	});

	it("should register several pathnames within a route", function () {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example.com', '192.168.1.2:8080');
		reverser.register('example.com/qux/baz', '192.168.1.5:8080');
		reverser.register('example.com/foo', '192.168.1.3:8080');
		reverser.register('example.com/bar', '192.168.1.4:8080');

		expect(reverser.routing).to.have.property("example.com")

		const host = reverser.routing["example.com"];
		expect(host).to.be.an("array");
		expect(host[0]).to.have.property('path')
		expect(host[0].path).to.be.eql('/qux/baz');
		expect(host[0].urls).to.be.an('array');
		expect(host[0].urls.length).to.be.eql(1);
		expect(host[0].urls[0].href).to.be.eql('http://192.168.1.5:8080/');

		expect(host[0].path.length).to.be.least(host[1].path.length)
		expect(host[1].path.length).to.be.least(host[2].path.length)
		expect(host[2].path.length).to.be.least(host[3].path.length)

		reverser.unregister('example.com');
		expect(reverser.resolve('example.com')).to.be.an("undefined")

		expect(reverser.resolve('example.com', '/foo')).to.be.an("object")

		reverser.unregister('example.com/foo');
		expect(reverser.resolve('example.com', '/foo')).to.be.an("undefined")

		reverser.close();
	});

	it("shouldn't crash process in unregister of unregisted host", function (done) {
		const reverser = new Reverser(opts);

		reverser.unregister('example.com');

		done();

		reverser.close();
	})
});

describe("Route resolution", function () {
	it("should resolve to a correct route", function () {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example.com', '192.168.1.2:8080');
		reverser.register('example.com/qux/baz', '192.168.1.5:8080');
		reverser.register('example.com/foo', '192.168.1.3:8080');
		reverser.register('example.com/bar', '192.168.1.4:8080');
		reverser.register('example.com/foo/baz', '192.168.1.3:8080');

		const route = reverser.resolve('example.com', '/foo/asd/1/2');
		expect(route.path).to.be.eql('/foo')
		expect(route.urls.length).to.be.eql(1);
		expect(route.urls[0].href).to.be.eql('http://192.168.1.3:8080/');

		reverser.close();
	})

	it("should resolve to a correct route with complex path", function () {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example.com', '192.168.1.2:8080');
		reverser.register('example.com/qux/baz', '192.168.1.5:8080');
		reverser.register('example.com/foo', '192.168.1.3:8080');
		reverser.register('example.com/bar', '192.168.1.4:8080');
		reverser.register('example.com/foo/baz', '192.168.1.7:8080');

		const route = reverser.resolve('example.com', '/foo/baz/a/b/c');

		expect(route.path).to.be.eql('/foo/baz')
		expect(route.urls.length).to.be.eql(1);
		expect(route.urls[0].href).to.be.eql('http://192.168.1.7:8080/');

		reverser.close();
	})

	it("should resolve to undefined if route not available", function () {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example.com', '192.168.1.2:8080');
		reverser.register('example.com/qux/baz', '192.168.1.5:8080');
		reverser.register('example.com/foo', '192.168.1.3:8080');
		reverser.register('foobar.com/bar', '192.168.1.4:8080');
		reverser.register('foobar.com/foo/baz', '192.168.1.3:8080');

		let route = reverser.resolve('wrong.com');
		expect(route).to.be.an('undefined')

		route = reverser.resolve('foobar.com');
		expect(route).to.be.an('undefined')

		reverser.close();
	});

	it("should get a target if route available", function () {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example.com', '192.168.1.2:8080');
		reverser.register('example.com/qux/baz', '192.168.1.5:8080');
		reverser.register('example.com/foo', '192.168.1.3:8080');
		reverser.register('foobar.com/bar', '192.168.1.4:8080');
		reverser.register('foobar.com/foo/baz', '192.168.1.7:8080');
		reverser.register('foobar.com/media', '192.168.1.7:8080');

		let route = reverser.resolve('example.com', '/qux/a/b/c');
		expect(route.path).to.be.eql('/');

		route = reverser.resolve('foobar.com', '/medias/');
		expect(route).to.be.undefined;

		route = reverser.resolve('foobar.com', '/mediasa');
		expect(route).to.be.undefined;

		route = reverser.resolve('foobar.com', '/media/sa');
		expect(route.path).to.be.eql('/media');

		const target = reverser._getTarget('example.com', {url: '/foo/baz/a/b/c'});
		expect(target.href).to.be.eql('http://192.168.1.3:8080/')

		reverser.close();
	});

	it("should get a target with path when necessary", function () {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example.com', '192.168.1.2:8080');
		reverser.register('example.com/qux/baz', '192.168.1.5:8080');
		reverser.register('example.com/foo', '192.168.1.3:8080/a/b');
		reverser.register('foobar.com/bar', '192.168.1.4:8080');
		reverser.register('foobar.com/foo/baz', '192.168.1.7:8080');

		const route = reverser.resolve('example.com', '/qux/a/b/c');
		expect(route.path).to.be.eql('/');

		const req = {url: '/foo/baz/a/b/c'}
		const target = reverser._getTarget('example.com', req);
		expect(target.href).to.be.eql('http://192.168.1.3:8080/a/b')
		expect(req.url).to.be.eql('/a/b/baz/a/b/c')

		reverser.close();
	})
});

describe("TLS/SSL", function () {
	it("should allow TLS/SSL certificates", function () {
		const reverser = new Reverser({
			ssl: {
				port: 4430
			},
			bunyan: false
		});

		expect(reverser.routing).to.be.an("object");
		reverser.register('example.com', '192.168.1.1:8080', {
			ssl: {
				key: 'dummy',
				cert: 'dummy'
			}
		});

		reverser.register('example.com', '192.168.1.2:8080');

		expect(reverser.certs).to.be.an("object");
		// expect(reverser.certs['example.com']).to.be.an("object");
		expect(reverser.certs['example.com']).to.be.ok;

		reverser.unregister('example.com', '192.168.1.1:8080');
		expect(reverser.resolve('example.com')).to.not.be.an("undefined");
		expect(reverser.certs['example.com']).to.not.be.an("undefined");

		reverser.unregister('example.com', '192.168.1.2:8080');
		expect(reverser.resolve('example.com')).to.be.an("undefined");
		expect(reverser.certs['example.com']).to.be.an("undefined");

	})
});


describe("Load balancing", function () {
	it("should load balance between several targets", function () {
		const reverser = new Reverser(opts);

		expect(reverser.routing).to.be.an("object");

		reverser.register('example.com', '192.168.1.1:8080');
		reverser.register('example.com', '192.168.1.2:8080');
		reverser.register('example.com', '192.168.1.3:8080');
		reverser.register('example.com', '192.168.1.4:8080');

		expect(reverser.routing['example.com'][0].urls.length).to.be.eql(4);
		expect(reverser.routing['example.com'][0].rr).to.be.eql(0);

		const route = reverser.resolve('example.com', '/foo/qux/a/b/c');
		expect(route.urls.length).to.be.eql(4);

		for (let i = 0; i < 1000; i++) {
			let target = reverser._getTarget('example.com', {url: '/a/b/c'});
			expect(target.href).to.be.eql('http://192.168.1.1:8080/');
			expect(reverser.routing['example.com'][0].rr).to.be.eql(1);

			target = reverser._getTarget('example.com', {url: '/x/y'});
			expect(target.href).to.be.eql('http://192.168.1.2:8080/');
			expect(reverser.routing['example.com'][0].rr).to.be.eql(2);

			target = reverser._getTarget('example.com', {url: '/j'});
			expect(target.href).to.be.eql('http://192.168.1.3:8080/');
			expect(reverser.routing['example.com'][0].rr).to.be.eql(3);

			target = reverser._getTarget('example.com', {url: '/k/'});
			expect(target.href).to.be.eql('http://192.168.1.4:8080/');
			expect(reverser.routing['example.com'][0].rr).to.be.eql(0);
		}

		reverser.unregister('example.com', '192.168.1.1:8080');
		expect(reverser.resolve('example.com')).to.not.be.an("undefined");

		reverser.unregister('example.com', '192.168.1.2:8080');
		expect(reverser.resolve('example.com')).to.not.be.an("undefined");

		reverser.unregister('example.com', '192.168.1.3:8080');
		expect(reverser.resolve('example.com')).to.not.be.an("undefined");

		reverser.unregister('example.com', '192.168.1.4:8080');
		expect(reverser.resolve('example.com')).to.be.an("undefined");

		reverser.close();
	});
});
