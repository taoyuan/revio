"use strict";

const _ = require('lodash');
const minimatch = require('minimatch');
const utils = require('../utils');

module.exports = function (server, priority) {
	priority = priority || 0;

	function routing(host, url) {
		if (!host) return;

		const routes = _.find(server.routing, (routes, hostname) => {
			return minimatch(host, hostname, {nocase: true});
		});

		return _.find(routes, route => route.path === '/' || utils.startsWith(url || '/', route.path));
	}

	routing.priority = priority;

	return routing;
};
