"use strict";

const _ = require('lodash');

module.exports = function (letsencryptHost, priority) {
	priority = priority || 0;
	function challenge(host, url) {
		if (/^\/.well-known\/acme-challenge/.test(url)) {
			return letsencryptHost + '/' + host;
		}
	}
	challenge.priority = priority;
	return challenge;
};
