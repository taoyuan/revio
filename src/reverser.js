"use strict";

const assert = require('assert');
const tls = require('tls');
const http = require('http');
const httpProxy = require('http-proxy');
const path = require('path');
const _ = require('lodash');
const cluster = require('cluster');
const hash = require('object-hash');
const LRUCache = require("lru-cache");
const routeCache = LRUCache({max: 5000});
const safe = require('safetimeout');
const PromiseA = require('bluebird');

const Logger = require('./logger');
const Les = require('./les');
const Resolvers = require('./resolvers');
const utils = require('./utils');

const ONE_DAY = 60 * 60 * 24 * 1000;
const ONE_MONTH = ONE_DAY * 30;

let respondNotFound = function (req, res) {
	res.statusCode = 404;
	res.write('Not Found');
	res.end();
};

class Reverser {

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
			routeObject.urls = [Reverser.buildTarget(route)];
			routeObject.path = '/';
		} else {
			if (!route.hasOwnProperty('url')) {
				return null;
			}

			routeObject.urls = (_.isArray(route.url) ? route.url : [route.url]).map(url => {
				return Reverser.buildTarget(url, route.opts || {});
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
			for (let i = 0; i < opts.cluster; i++) {
				cluster.fork();
			}

			cluster.on('exit', function (worker, code, signal) {
				// Fork if a worker dies.
				log.error({code: code, signal: signal},
					'worker died un-expectedly... restarting it.');
				cluster.fork();
			});

			return;
		}

		this.resolvers = [Resolvers.routing(this)];

		opts.port = opts.port || 8080;

		if (opts.letsencrypt) {
			this.setupLetsEncrypt(opts);
		}

		if (opts.resolvers) {
			this.addResolver(opts.resolvers);
		}

		//
		// Create a proxy server with custom application logic
		//
		const proxy = this.proxy = httpProxy.createProxyServer({
			xfwd: (opts.xfwd != false),
			prependPath: false,
			secure: (opts.secure !== false),
			/*
			 agent: new http.Agent({
			 keepAlive: true
			 })
			 */
		});

		proxy.on('proxyReq', (p, req) => {
			if (req.host != null) {
				p.setHeader('host', req.host);
			}
		});

		//
		// Support NTLM auth
		//
		if (opts.ntlm) {
			proxy.on('proxyRes', proxyRes => {
				const key = 'www-authenticate';
				proxyRes.headers[key] = proxyRes.headers[key] && proxyRes.headers[key].split(',');
			});
		}

		//
		// Optionally create an https proxy server.
		//
		if (opts.ssl) {
			this.setupHttpsProxy();
		}

		//
		// Plain HTTP Proxy
		//
		const server = this.setupHttpProxy();

		server.listen(opts.port);

		proxy.on('error', (err, req, res) => {
			//
			// Send a 500 http status if headers have been sent
			//
			console.log(err);

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

			//
			// TODO: if err.code=ECONNREFUSED and there are more servers
			// for this route, try another one.
			//
			res.end(err.code)
		});

		this.log.info('Started a Evoxy reverse proxy server on port %s', opts.port);

	}

	_websocketsUpgrade(req, socket, head) {
		const src = utils.getSource(req);
		const target = this._getTarget(src, req);
		this.log.info({headers: req.headers, target: target}, 'upgrade to websockets');
		if (target) {
			this.proxy.ws(req, socket, head, {target: target});
		} else {
			respondNotFound(req, socket);
		}
	};

	_getTarget(src, req) {
		const url = req.url;
		const route = this.resolve(src, url);

		if (!route) {
			this.log.warn({src: src, url: req.url}, 'no valid route found for given source');
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
		// Fix request url if targetname specified.
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

	setupLetsEncrypt(opts) {
		if (!opts.letsencrypt.path) {
			throw Error('Missing certificate path for Lets Encrypt');
		}
		this.les = new Les(opts.letsencrypt, this.log);
		const letsencryptPort = opts.letsencrypt.port || 3000;
		const challengeResolver = Resolvers.challenge(letsencryptPort);
		challengeResolver.priority = 9999;
		this.addResolver(challengeResolver);
	};

	setupHttpProxy() {
		const {proxy, opts, _websocketsUpgrade} = this;
		const server = this.server = http.createServer((req, res) => {
			const src = utils.getSource(req);
			const target = this._getTarget(src, req);
			if (target) {
				if (utils.shouldRedirectToHttps(this.certs, src, target)) {
					utils.redirectToHttps(req, res, target, opts.ssl, this.log);
				} else {
					proxy.web(req, res, {target: target});
				}
			} else {
				respondNotFound(req, res);
			}
		});

		//
		// Listen to the `upgrade` event and proxy the
		// WebSocket requests as well.
		//
		server.on('upgrade', _websocketsUpgrade);

		server.on('error', err => {
			this.log.error(err, 'Server Error');
		});

		return server;
	}

	setupHttpsProxy() {
		const {proxy, opts, _websocketsUpgrade} = this;
		const certs = this.certs = {};
		const sni = this.les && this.les.le.sni;

		let options = {
			SNICallback: function (hostname, cb) {
				if (!certs[hostname] && sni) {
					return PromiseA.fromCallback(cb => sni.sniCallback(hostname, cb)).nodeify(cb);
				}
				return PromiseA.resolve(certs[hostname]).nodeify(cb);
			},
			//
			// Default certs for clients that do not support SNI.
			//
			key: utils.getCertData(opts.ssl.key) || undefined,
			cert: utils.getCertData(opts.ssl.cert) || undefined
		};

		if (opts.ssl.ca) {
			options.ca = utils.getCertData(opts.ssl.ca, true);
		}

		if (opts.ssl.opts) {
			options = _.defaults(options, opts.ssl.opts);
		}

		const https = opts.ssl.http2 ? require('spdy') : require('https');
		if (_.isObject(opts.http2)) {
			opts.ssl.spdy = opts.ssl.http2;
		}

		options = _.defaults(options, require('localhost.daplie.com-certificates').merge({}));

		const httpsServer = this.httpsServer = https.createServer(options, (req, res) => {
			const src = utils.getSource(req);

			const target = this._getTarget(src, req);
			if (target) {
				proxy.web(req, res, {target: target});
			} else {
				respondNotFound(req, res);
			}
		});

		httpsServer.on('upgrade', _websocketsUpgrade);
		httpsServer.on('error', err => this.log.error(err, 'HTTPS Server Error'));
		httpsServer.on('clientError', err => this.log.error(err, 'HTTPS Client  Error'));

		this.log.info('Listening to HTTPS requests on port %s', opts.ssl.port);

		httpsServer.listen(opts.ssl.port);
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
					throw Error('Cannot register https routes without defining a ssl port');
				}

				if (!this.certs[src.hostname]) {
					if (ssl.key || ssl.cert || ssl.ca) {
						this.certs[src.hostname] = utils.createCredentialContext(ssl.key, ssl.cert, ssl.ca);
					} else if (ssl.letsencrypt) {
						if (!this.opts.letsencrypt || !this.opts.letsencrypt.path) {
							console.error('Missing certificate path for Lets Encrypt');
							return;
						}
						this.log.info('Getting Lets Encrypt certificates for %s', src.hostname);
						this.updateCertificates(src.hostname, ssl.letsencrypt.email, ssl.letsencrypt.production);
					} else {
						// Trigger the use of the default certificates.
						this.certs[src.hostname] = void 0;
					}
				}
			}
		}
		target = Reverser.buildTarget(target, opts);

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

	updateCertificates(domain, email) {
		const {opts} = this;

		const renewCertificate = () => {
			this.log.info('Renewing letsencrypt certificates for %s', domain);
			this.updateCertificates(domain, email);
		};

		return this.les.fetch(domain, email, opts.letsencrypt).then(certs => {
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
				renewTime = renewTime > 0 ? renewTime : 0;

				this.log.info('Renewal of %s in %s days', domain, Math.floor(renewTime / ONE_DAY));

				this.certs[domain].renewalTimeout = safe.setTimeout(renewCertificate, renewTime);
			} else {
				// TODO: Try again, but we need an exponential backof to avoid getting banned.
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
			route = route && Reverser.buildRoute(route);
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
			this.server.close();
			this.httpsServer && this.httpsServer.close();
		} catch (err) {
			// Ignore for now...
		}
	};

	notFound(callback) {
		if (typeof callback == "function") {
			return respondNotFound = callback;
		}
		throw new Error('notFound callback is not a function');
	};

}


module.exports = Reverser;
