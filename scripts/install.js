"use strict";

const os = require('os');
const fs = require('fs-extra');
const path = require('path');

console.log('[revio] Installing on', os.platform());

let base = undefined;

if (['linux', 'freebsd', 'openbsd'].includes(os.platform())) {
	base = '/etc/revio';
}

if (base) {
	const file = path.join(base, 'revio.yml');
	console.log('[revio] Suring directory:', base);
	fs.mkdirpSync(base);

	if (!fs.existsSync(file)) {
		console.log('[revio] Generating default config file:', file);
		fs.copySync(path.join(__dirname, '..', 'default.config.yml'), file);
	}
}

console.log('[revio] Installation complete');

