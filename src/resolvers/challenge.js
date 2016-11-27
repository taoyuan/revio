"use strict";

module.exports = function (port, priority) {
	priority = priority || 0;
	function challenge(host, url) {
		if (/^\/.well-known\/acme-challenge/.test(url)) {
			return 'http://127.0.0.1:' + port + '/' + host;
		}
	}
	challenge.priority = priority;
	return challenge;
};
