"use strict";

const Docker = require('./docker');

module.exports  = function (server, config) {
	const docker = new Docker(server);

	// Using routes parser to parse config to make config grammar to keep same as routes dose
	require('./routes')(docker, config);
};
