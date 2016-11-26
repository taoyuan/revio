"use strict";

const os = require('os');
const fs = require('fs-extra');
const path = require('path');

console.log('[evoxy] Installing on', os.platform());

let base = undefined;

if (['linux', 'freebsd', 'openbsd'].includes(os.platform())) {
	base = '/etc/evoxy';
}

if (base) {
	const file = path.join(base, 'evoxy.yml');
	console.log('[evoxy] Suring directory:', base);
	fs.mkdirpSync(base);

	if (!fs.existsSync(file)) {
		console.log('[evoxy] Generating default config file:', file);
		fs.copySync(path.join(__dirname, '..', 'default.config.yml'), file);
	}
}

console.log('[evoxy] Installation complete');

