"use strict";

const _ = require('lodash');
const tls = require('tls');
const validUrl = require('valid-url');
const parseUrl = require('url').parse;

function sureArray(value) {
	if (_.isNil(value)) return value;
	return _.isArray(value) ? value : [value];
}
exports.sureArray = sureArray;

function shouldRedirectToHttps(certs, src, target) {
	return certs && src in certs && target.sslRedirect;
}
exports.shouldRedirectToHttps = shouldRedirectToHttps;

//
// Redirect to the HTTPS proxy
//
function redirectToHttps(req, res, target, ssl, log) {
	req.url = req._url || req.url; // Get the original url since we are going to redirect.

	const hostname = req.headers.host.split(':')[0] + ':' + (ssl.redirectPort || ssl.port);
	const url = 'https://' + path.join(hostname, req.url);
	log && log.info('Redirecting %s to %s', path.join(req.headers.host, req.url), url);
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
	const fs = require('fs');

	// TODO: Support input as Buffer, Stream or Pathname.

	if (pathname) {
		if (_.isArray(pathname)) {
			const pathnames = pathname;
			return _.flatten(_.map(pathnames, function (_pathname) {
				return getCertData(_pathname, unbundle);
			}));
		} else if (fs.existsSync(pathname)) {
			if (unbundle) {
				return unbundleCert(fs.readFileSync(pathname, 'utf8'));
			} else {
				return fs.readFileSync(pathname, 'utf8');
			}
		}
	}
}
exports.getCertData = getCertData;


//
// https://stackoverflow.com/questions/18052919/javascript-regular-expression-to-add-protocol-to-url-string/18053700#18053700
// Adds http protocol if non specified.
function setHttp(link) {
	if (link.search(/^http[s]?\:\/\//) === -1) {
		link = 'http://' + link;
	}
	return link;
}
exports.setHttp = setHttp;


function startsWith(input, str) {
	return input.slice(0, str.length) === str &&
		(input.length === str.length || input[str.length] === '/')
}
exports.startsWith = startsWith;

function prepareUrl(url) {
	url = _.clone(url);
	if (_.isString(url)) {
		url = setHttp(url);

		if (!validUrl.isHttpUri(url) && !validUrl.isHttpsUri(url)) {
			throw Error('uri is not a valid http uri ' + url);
		}

		url = parseUrl(url);
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
