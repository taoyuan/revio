"use strict";

const assert = require('assert');
const tls = require('tls');
const http = require('http');
const HttpProxy = require('http-proxy');
const path = require('path');
const _ = require('lodash');
const cluster = require('cluster');
const hash = require('object-hash');
const LRUCache = require("lru-cache");
const routeCache = LRUCache({max: 5000});
const safe = require('safetimeout');
const PromiseA = require('bluebird');

const Logger = require('./logger');
const Certifier = require('./certifier');
const Resolvers = require('./resolvers');
const utils = require('./utils');
const arrify = require("arrify");

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_MONTH = ONE_DAY * 30;

let respondNotFound = function (req, res) {
	res.statusCode = 404;
	res.write('Not Found');
	res.end();
};

class Server {

	static buildTarget(target, opts) {
		opts = opts || {};
		target = utils.prepareUrl(target);
		target.sslRedirect = !opts.ssl || opts.ssl.redirect !== false;
		target.useTargetHostHeader = opts.useTargetHostHeader === true;
		return target;
	}

	static buildRoute(route) {
		if (!_.isString(route) && !_.isObject(route)) {
			return null;
		}

		if (_.isObject(route) && route.hasOwnProperty('urls') && route.hasOwnProperty('path')) {
			// default route type matched.
			return route;
		}

		const cacheKey = _.isString(route) ? route : hash(route);
		const entry = routeCache.get(cacheKey);
		if (entry) {
			return entry;
		}

		const routeObject = {rr: 0, isResolved: true};
		if (_.isString(route)) {
			routeObject.urls = [Server.buildTarget(route)];
			routeObject.path = '/';
		} else {
			if (!route.hasOwnProperty('url')) {
				return null;
			}

			routeObject.urls = arrify(route.url).map(url => {
				return Server.buildTarget(url, route.opts || {});
			});

			routeObject.path = route.path || '/';
		}
		routeCache.set(cacheKey, routeObject);
		return routeObject;
	}

	constructor(opts) {
		this.opts = opts = opts || {};

		const logger = opts.bunyan || opts.logger;
		this.log = logger !== false ? Logger.get(logger) : Logger.noop;

		//
		// Routing table.
		//
		this.routing = {};

		this._setup();
	}

	_setup() {
		const {opts, log} = this;

		if (opts.cluster && typeof opts.cluster !== 'number' || opts.cluster > 32) {
			throw Error('cluster setting must be an integer less than 32');
		}

		if (opts.cluster && cluster.isMaster) {
			return this._setupCluster(opts);
		}

		this.resolvers = [Resolvers.routing(this)];

		opts.port = opts.port || 8080;

		if (opts.letsencrypt) {
			this.setupCertifier(opts.letsencrypt);
		}

		if (opts.resolvers) {
			this.addResolver(opts.resolvers);
		}

		//
		// Create a proxy server with custom application logic
		//
		const _proxy = this._proxy = HttpProxy.createProxyServer({
			xfwd: (opts.xfwd !== false),
			prependPath: false,
			secure: (opts.secure !== false),
			agent: new http.Agent({
				keepAlive: _.has(opts, 'keepAlive') ? opts.keepAlive : true,
				maxSockets: 512
			})
		});

		_proxy.on('proxyReq', (p, req) => {
			if (!_.isNil(req.host)) {
				p.setHeader('host', req.host);
			}
		});

		//
		// Support NTLM auth
		//
		if (opts.ntlm) {
			_proxy.on('proxyRes', proxyRes => {
				const key = 'www-authenticate';
				proxyRes.headers[key] = proxyRes.headers[key] && proxyRes.headers[key].split(',');
			});
		}

		//
		// Optionally create an https proxy server.
		//
		if (opts.ssl) {
			arrify(opts.ssl).forEach(o => this.setupHttpsProxy(o));
		}

		//
		// Plain HTTP Proxy
		//
		const httpServer = this.setupHttpProxy();

		httpServer.listen(opts.port);

		_proxy.on('error', (err, req, res) => {
			//
			// Send a 500 http status if headers have been sent
			//
			if (err.code === 'ECONNREFUSED') {
				res.writeHead && res.writeHead(502);
			} else if (!res.headersSent) {
				res.writeHead && res.writeHead(500);
			}

			//
			// Do not log this common error
			//
			if (err.message !== 'socket hang up') {
				log.error(err, 'Proxy Error');
			}

			// Exit program for EMFILE temporary, and restart using PM2.
			// TODO Should not have EMFILE error, dig it ...
			if (err.code === 'EMFILE') {
				console.log('----------------------');
				return process.exit(1);
			}

			//
			// TODO: if err.code=ECONNREFUSED and there are more servers
			// for this route, try another one.
			//
			res.end(err.code)
		});

		this.log.info('Started a Revio reverse proxy server on port %s', opts.port);
	}

	_setupCluster(opts) {
		opts = opts || this.opts;

		for (let i = 0; i < opts.cluster; i++) {
			cluster.fork();
		}

		cluster.on('exit', (worker, code, signal) => {
			// Fork if a worker dies.
			this.log.error({code: code, signal: signal}, 'worker died unexpectedly... restarting it.');
			cluster.fork();
		});
	}

	_websocketsUpgrade(req, socket, head) {
		const src = utils.getSource(req);
		const target = this._getTarget(src, req);
		this.log.info({headers: req.headers, target: target}, 'upgrade to websockets');
		if (target) {
			try {
				this._proxy.ws(req, socket, head, {target: target});
			} catch (e) {
				this.log.warn(e, 'Proxy ws error');
				return socket.end();
			}
		} else {
			respondNotFound(req, socket);
		}
	};

	_getTarget(src, req) {
		const url = req.url;
		const route = this.resolve(src, url);

		if (!route) {
			this.log.warn({src, url}, 'no valid route found for given source');
			return;
		}

		const pathname = route.path;
		if (pathname.length > 1) {
			//
			// remove prefix from src
			//
			req._url = url; // save original url
			req.url = url.substr(pathname.length) || '/';
		}

		//
		// Perform Round-Robin on the available targets
		// TODO: if target errors with EHOSTUNREACH we should skip this
		// target and try with another.
		//
		const urls = route.urls;
		const j = route.rr;
		route.rr = (j + 1) % urls.length; // get and update Round-robin index.
		const target = route.urls[j];

		//
		// Fix request url if target name specified.
		//
		if (target.pathname) {
			req.url = path.join(target.pathname, req.url);
		}

		//
		// Host headers are passed through from the source by default
		// Often we want to use the host header of the target instead
		//
		if (target.useTargetHostHeader === true) {
			req.host = target.host;
		}

		this.log.info('Proxying %s to %s', src + url, path.join(target.host, req.url));

		return target;
	};

	setupCertifier(opts) {
		if (!opts.path) {
			throw Error('Missing certificate path for Lets Encrypt');
		}
		opts.port = opts.port || 9999;
		this.certifier = new Certifier(opts, this.log);
		this.letsencryptHost = '127.0.0.1:' + opts.port;
		const url = 'http://' + this.letsencryptHost;
		const challengeResolver = Resolvers.challenge(url, 9999);
		this.addResolver(challengeResolver);
	};

	setupHttpProxy() {
		const {_proxy, opts, _websocketsUpgrade} = this;
		const httpServer = this.httpServer = http.createServer((req, res) => {
			const src = utils.getSource(req);
			const target = this._getTarget(src, req);
			if (target) {
				if (utils.shouldRedirectToHttps(this.certs, src, target, [this.letsencryptHost])) {
					utils.redirectToHttps(req, res, target, opts.ssl, this.log);
				} else {
					try {
						_proxy.web(req, res, {target});
					} catch (e) {
						this.log.warn(e, 'Proxy web error');
						return res.end();
					}
				}
			} else {
				respondNotFound(req, res);
			}
		});

		//
		// Listen to the `upgrade` event and proxy the
		// WebSocket requests as well.
		//
		httpServer.on('upgrade', _websocketsUpgrade);
		httpServer.on('error', err => this.log.error(err, 'Server Error'));

		return httpServer;
	}

	setupHttpsProxy(opts) {
		const {_proxy, _websocketsUpgrade} = this;
		const certs = this.certs = {};
		const sni = _.get(this.certifier, 'le.sni');

		let options = {
			SNICallback: (hostname, cb) => {
				if (certs[hostname]) {
					return PromiseA.resolve(certs[hostname]).nodeify(cb);
				}
				if (sni && hostname && hostname.endsWith('.acme.invalid')) {
					this.log.info('Perform Letsencrypt SNI challenge for host', hostname);
					return PromiseA.fromCallback(cb => sni.sniCallback(hostname, cb)).nodeify(cb);
				}
				cb();
			},
			//
			// Default certs for clients that do not support SNI.
			//
			key: utils.getCertData(opts.key) || undefined,
			cert: utils.getCertData(opts.cert) || undefined
		};

		if (opts.ca) {
			options.ca = utils.getCertData(opts.ca, true);
		}

		if (opts.opts) {
			options = _.defaults(options, opts.opts);
		}

		const https = opts.http2 ? require('spdy') : require('https');
		if (_.isObject(opts.http2)) {
			opts.spdy = opts.http2;
		}

		options = _.defaults(options, require('localhost.daplie.com-certificates').merge({}));

		const httpsServer = this.httpsServer = https.createServer(options, (req, res) => {
			const src = utils.getSource(req);

			const target = this._getTarget(src, req);
			if (target) {
				try {
					_proxy.web(req, res, {target});
				} catch (e) {
					this.log.warn(e, 'Proxy web error');
					return res.end();
				}
			} else {
				respondNotFound(req, res);
			}
		});

		httpsServer.on('upgrade', _websocketsUpgrade);
		httpsServer.on('error', err => this.log.error(err, 'HTTPS Server Error'));
		httpsServer.on('clientError', (err, socket) => {
			this.log.warn('HTTPS Client Error:', err.message);
			this.log.debug(err, 'Error Detail:');
			return socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
		});

		this.log.info('Listening to HTTPS requests on port %s', opts.port);

		httpsServer.listen(opts.port, opts.ip);
	}

	addResolver(resolver) {
		return this.addResolvers(resolver);
	}

	addResolvers(resolvers) {
		if (this.opts.cluster && cluster.isMaster) return this;

		resolvers = utils.sureArray(resolvers);

		_.forEach(resolvers, r => {
			assert(_.isFunction(r), "Resolver must be an invokable function.");
			if (!r.hasOwnProperty('priority')) {
				r.priority = 0;
			}
		});

		this.resolvers.push(...resolvers);
		this.resolvers = _(this.resolvers).uniq().sortBy(r => -r.priority).value();
	};

	removeResolver(resolver) {
		if (this.opts.cluster && cluster.isMaster) return this;

		// since unique resolvers are not checked for performance, just remove every existence.
		this.resolvers = _.filter(this.resolvers, r => r !== resolver);
	}

	/**
	 Register a new route.

	 @param {String|URL} src A string or a url parsed by node url module.
	 Note that port is ignored, since the proxy just listens to one port.

	 @param {String|URL|Array} target A string or a url parsed by node url module.
	 @param {Object} [opts] Route options.
	 */
	register(src, target, opts) {
		if (this.opts.cluster && cluster.isMaster) return this;

		if (!src || !target) {
			throw Error('Cannot register a new route with unspecified src or target');
		}

		const routing = this.routing;

		src = utils.prepareUrl(src);

		if (opts) {
			const ssl = opts.ssl;
			if (ssl) {
				if (!this.httpsServer) {
					throw new Error('Cannot register https routes without defining a ssl port');
				}

				if (!utils.isHostname(src.hostname)) {
					throw new Error(`Hostname "${src.hostname}" is not valid for fetching ssl cert`);
				}

				if (!this.certs[src.hostname]) {
					if (ssl.key || ssl.cert || ssl.ca) {
						this.certs[src.hostname] = utils.createCredentialContext(ssl.key, ssl.cert, ssl.ca);
					} else if (ssl.letsencrypt) {
						if (!this.opts.letsencrypt || !this.opts.letsencrypt.path) {
							console.error('Missing certificate path for Lets Encrypt');
							return;
						}
						this.certifier.addDomain(src.hostname);
						this.log.info('Getting Lets Encrypt certificates for %s', src.hostname);
						this.updateCertificates(src.hostname, ssl.letsencrypt.email, ssl.letsencrypt.production);
					} else {
						// Trigger the use of the default certificates.
						this.certs[src.hostname] = void 0;
					}
				}
			}
		}
		target = Server.buildTarget(target, opts);

		const hosts = routing[src.hostname] = routing[src.hostname] || [];
		const pathname = src.pathname || '/';

		let route = _.find(hosts, {path: pathname});

		if (!route) {
			route = {path: pathname, rr: 0, urls: []};
			hosts.push(route);

			//
			// Sort routes
			//
			routing[src.hostname] = _.sortBy(hosts, h => -h.path.length);
		}

		route.urls.push(target);

		this.log.info({from: src, to: target}, 'Registered a new route');
		return this;
	};

	updateCertificates(domain, email, renew) {
		const {opts} = this;
		const fetchOpts = Object.assign({}, opts.letsencrypt, {renew});

		const renewCertificate = () => {
			this.log.info('Renewing letsencrypt certificates for %s', domain);
			this.updateCertificates(domain, email, true);
		};

		return this.certifier.fetch(domain, email, fetchOpts).then(certs => {
			if (certs) {
				this.certs[domain] = tls.createSecureContext({
					key: certs.privkey,
					cert: certs.cert + certs.chain
				}).context;

				//
				// TODO: make renewal timeout configurable and cluster friendly
				//
				const timeBeforeExpiration = opts.letsencrypt.expireBefore || ONE_MONTH;
				let renewTime = (certs.expiresAt - Date.now()) - timeBeforeExpiration;
				renewTime = renewTime > 0 ? renewTime : opts.letsencrypt.minRenewTime || ONE_HOUR;

				this.log.info('Renewal of %s in %s days', domain, Math.floor(renewTime / ONE_DAY));

				this.certs[domain].renewalTimeout = safe.setTimeout(renewCertificate, renewTime);
			} else {
				//
				// TODO: Try again, but we need an exponential back off to avoid getting banned.
				//
			}
		}, err => console.error('Getting LetsEncrypt certificates', err));
	};

	unregister(src, target) {
		if (this.opts.cluster && cluster.isMaster) return this;

		if (!src) return this;

		src = utils.prepareUrl(src);
		const routes = this.routing[src.hostname] || [];
		const pathname = src.pathname || '/';

		const route = _.find(routes, r => r.path === pathname);

		if (route) {
			if (target) {
				target = utils.prepareUrl(target);
				_.remove(route.urls, url => url.href === target.href);
			} else {
				route.urls = [];
			}

			if (route.urls.length === 0) {
				routes.splice(routes.indexOf(route), 1);
				const certs = this.certs;
				if (certs) {
					if (certs[src.hostname] && certs[src.hostname].renewalTimeout) {
						safe.clearTimeout(certs[src.hostname].renewalTimeout);
					}
					delete certs[src.hostname];
				}
			}

			this.log.info({from: src, to: target}, 'Unregistered a route');
		}

		return this;
	};

	resolve(host, url) {
		host = host && host.toLowerCase();

		let route;
		const resolved = _.find(this.resolvers, resolver => {
			route = resolver.call(this, host, url);
			route = route && Server.buildRoute(route);
			// ensure resolved route has path that prefixes URL
			// no need to check for native routes.
			if (route && (!route.isResolved || route.path === '/' || utils.startsWith(url, route.path))) {
				return route;
			}
		});
		return resolved && route;
	};

	close() {
		try {
			this.httpServer.close();
			this.httpsServer && this.httpsServer.close();
		} catch (err) {
			// Ignore for now...
		}
	};

	notFound(callback) {
		if (_.isFunction(callback)) {
			return respondNotFound = callback;
		}
		throw new Error('notFound callback is not a function');
	};

}

module.exports = Server;
