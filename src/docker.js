/*eslint-env node */
"use strict";

/**
 *
 * Evoxy Docker Module from Redbird.

 * This module handles automatic registration and de-registration of
 * services running on docker containers.
 */

const _ = require('lodash');
const Dolphin = require('dolphin');

class Docker {
	constructor(server, url) {

		this.server = server;
		const log = this.log =  server.log;

		const targets = this.targets = {};
		this.ports = {};

		//
		// We keep an up-to-date table with all the images having
		// containers running on the system.
		//
		const images = this.images = {};
		const dolphin = this.dolphin = new Dolphin(url);

		const registerIfNeeded = (imageName, containerId, containerNames) => {
			const image = images[imageName] = images[imageName] || {};
			const target = targets[imageName];

			if (target && image[containerId] !== 'running') {
				log && log.info('Registering container %s for target %s', containerId, target.src);
				this.registerContainer(target.src, containerId, target.opts);
			}
			image[containerId] = 'running';
		};

		//
		// Start docker event listener
		//
		this.events = dolphin.events();

		this.events.on('connected', () => {
			//
			//  Fetch all running containers and register them if
			//  necessary.
			//
			dolphin.containers({filters: {status: ["running"]}}).then(containers => {
				containers.forEach(c => registerIfNeeded(c.Image, c.Id, c.Names));
			});
		});

		this.events.on('event', (evt) => {
			let image, target;

			log && log.info('Container %s changed to status %s', evt.id, evt.status);

			switch (evt.status) {
				case 'start':
				case 'restart':
				case 'unpause':
					registerIfNeeded(evt.from, evt.id);
					break;
				case 'stop':
				case 'die':
				case 'pause':
					image = images[evt.from];
					target = targets[evt.from];
					if (image) {
						if (image[evt.id] === 'running' && target && this.ports[evt.id]) {
							log && log.info('Un-registering container %s for target %s', evt.id, target.src);
							this.server.unregister(target.src, this.ports[evt.id]);
						}
						image[evt.id] = 'stopped';
					}
					break;
				default:
				// Nothing
			}
		});

		this.events.on('error', (err) => {
			log && log.error(err, 'dolphin docker event error');
		});
	}

	/**
	 *
	 * Register route from a source to a given target.
	 *
	 * The target should be an image name. Starting several containers
	 * from the same image will automatically deliver the requests
	 * to each container in a round-robin fashion.
	 *
	 * @param src
	 * @param target
	 * @param opts
	 */
	register(src, target, opts) {
		if (this.targets[target]) {
			throw Error('Cannot register the same target twice');
		}

		this.targets[target] = {
			src: src,
			opts: opts
		};

		const image = this.images[target];
		if (image) {
			_.forEach(image, (state, id) => state === 'running' && this.registerContainer(src, id, opts));
		}
	};

	registerContainer(src, id, opts) {
		return this.dolphin.containers.inspect(id)
			.then(container => {
				const port = Object.keys(container.NetworkSettings.Ports)[0].split('/')[0];
				const ip = container.NetworkSettings.IPAddress;
				if (port && ip) {
					return 'http://' + ip + ':' + port;
				} else {
					throw Error('No valid address or port ' + container.IPAddress + ':' + port);
				}
			}).then(target => {
				this.server.register(src, target, opts);
				this.ports[id] = target;
			});
	};
}

module.exports = Docker;
