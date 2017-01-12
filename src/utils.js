"use strict";

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const tls = require('tls');
const validUrl = require('valid-url');
const parseUrl = require('url-parse');
const arrify = require('arrify');

const regIpAddress = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
const regHostname = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

function isIpAddress(ip) {
	if (!_.isString(ip)) return false;
	return regIpAddress.test(ip);
}
exports.isIpAddress = isIpAddress;

function isHostname(hostname) {
	if (!_.isString(hostname)) return false;
	return regHostname.test(hostname);
}
exports.isHostname = isHostname;


function sureArray(value) {
	if (_.isNil(value)) return value;
	return _.isArray(value) ? value : [value];
}
exports.sureArray = sureArray;

function shouldRedirectToHttps(certs, src, target, excludes) {
	if (excludes && arrify(excludes).includes(target.host)) {
		return false;
	}
	return certs && src in certs && target.sslRedirect;
}
exports.shouldRedirectToHttps = shouldRedirectToHttps;

//
// Redirect to the HTTPS proxy
//
function redirectToHttps(req, res, target, ssl, log) {
	req.url = req._url || req.url; // Get the original url since we are going to redirect.

	const port = ssl.redirectPort || ssl.port;
	const hostname = req.headers.host.split(':')[0] + (port ? ':' + port : '');
	const url = 'https://' + path.join(hostname, req.url);
	const from = path.join(req.headers.host, req.url);
	log && log.info(`Redirecting ${from} to ${url}`);
	//
	// We can use 301 for permanent redirect, but its bad for debugging, we may have it as
	// a configurable option.
	//
	res.writeHead(302, {Location: url});
	res.end();
}
exports.redirectToHttps = redirectToHttps;

//
// Helpers
//
function getSource(req) {
	if (req.headers.host) {
		return req.headers.host.split(':')[0];
	}
}
exports.getSource = getSource;

/**
 Unbundles a file composed of several certificates.
 http://www.benjiegillam.com/2012/06/node-dot-js-ssl-certificate-chain/
 */
function unbundleCert(bundle) {
	const chain = bundle.trim().split('\n');

	const ca = [];
	let cert = [];

	for (let i = 0, len = chain.length; i < len; i++) {
		const line = chain[i].trim();
		if (!(line.length !== 0)) {
			continue;
		}
		cert.push(line);
		if (line.match(/-END CERTIFICATE-/)) {
			const joined = cert.join('\n');
			ca.push(joined);
			cert = [];
		}
	}
	return ca;
}
exports.unbundleCert = unbundleCert;


function getCertData(pathname, unbundle) {
	// TODO: Support input as Buffer, Stream or Pathname.

	if (!pathname) return;

	if (_.isArray(pathname)) {
		return _.flatten(pathname.map(p => getCertData(p, unbundle)));
	}

	if (fs.existsSync(pathname) && fs.lstatSync(pathname).isFile()) {
		try {
			if (unbundle) {
				return unbundleCert(fs.readFileSync(pathname, 'utf8'));
			} else {
				return fs.readFileSync(pathname, 'utf8');
			}
		} catch (e) {
			console.warn(e);
		}
	}
}
exports.getCertData = getCertData;


//
// https://stackoverflow.com/questions/18052919/javascript-regular-expression-to-add-protocol-to-url-string/18053700#18053700
// Adds http protocol if non specified.
function sureProtocol(link, protocol = 'http') {
	if (link.search(/^http[s]?:\/\//) === -1) {
		link = protocol + '://' + link;
	}
	return link;
}
exports.sureProtocol = sureProtocol;


function startsWith(input, str) {
	return input.slice(0, str.length) === str &&
		(input.length === str.length || input[str.length] === '/')
}
exports.startsWith = startsWith;

function prepareUrl(url) {
	url = _.clone(url);
	if (_.isString(url)) {
		url = sureProtocol(url);

		if (!validUrl.isHttpUri(url) && !validUrl.isHttpsUri(url)) {
			throw Error('uri is not a valid http uri ' + url);
		}

		url = parseUrl(url);

		// make sure pathname and href has default value as url.parse
		if (url.hostname) {
			if (!url.pathname) {
				url.pathname = '/';
				if (url.href[url.href.length - 1] !== '/') {
				}
				url.href += '/';
			}
		}

	}
	return url;
}
exports.prepareUrl = prepareUrl;

function createCredentialContext(key, cert, ca) {
	const opts = {};

	opts.key = getCertData(key);
	opts.cert = getCertData(cert);
	if (ca) {
		opts.ca = getCertData(ca, true);
	}

	const credentials = tls.createSecureContext(opts);

	return credentials.context;
}
exports.createCredentialContext = createCredentialContext;
