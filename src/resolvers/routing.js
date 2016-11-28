"use strict";

const _ = require('lodash');
const utils = require('../utils');

module.exports = function (server, priority) {
	priority = priority || 0;

	function routing(host, url) {
		if (!host) return;
		return _.find(server.routing[host], route => route.path === '/' || utils.startsWith(url || '/', route.path));
	}
	routing.priority = priority;

	return routing;
};
