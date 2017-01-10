#!/usr/bin/env node

require("../src/cli")(process.argv).catch(function (err) {
	console.log(err);
	process.exit(1);
});
