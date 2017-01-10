# revio 
[![NPM version](http://img.shields.io/npm/v/revio.svg?style=flat-square)](https://www.npmjs.com/package/revio)
[![NPM downloads](http://img.shields.io/npm/dm/revio.svg?style=flat-square)](https://www.npmjs.com/package/revio)
[![Build Status](http://img.shields.io/travis/taoyuan/revio/master.svg?style=flat-square)](https://travis-ci.org/taoyuan/revio)
[![Coverage Status](https://img.shields.io/coveralls/taoyuan/revio.svg?style=flat-square)](https://coveralls.io/taoyuan/revio)


> A Reverse Proxy Server.  
> With built in Cluster, HTTP2, LetsEncrypt and Docker support 

## Highlights

- Out of the box command-line tool `revio` with yaml configuratio support (default: `/etc/revio/revio.yml`)
- Challenges `http-01` and `tls-sni-01` have been tested, and `dns-01` should work
- Wildcard hostname support like `www.*.example.com`

## SUPER HOT
Support for HTTP2. You can now enable HTTP2 just by setting the HTTP2 flag to true. Keep in mind that HTTP2 requires
SSL/TLS certificates. Thankfully we also support LetsEncrypt so this becomes easy as pie.

## HOT

We have now support for automatic generation of SSL certificates using [LetsEncrypt](#letsencrypt). Zero config setup for your
TLS protected services that just works.

## Features

- Flexible and easy routing
- Websockets
- Seamless SSL Support (HTTPS -> HTTP proxy)
- Automatic HTTP to HTTPS redirects
- Automatic TLS Certificates generation and renewal
- Load balancer
- Register and unregister routes programatically without restart (allows zero downtime deployments)
- Docker support for automatic registration of running containers
- Cluster support that enables automatic multi-process
- Based on top of rock-solid node-http-proxy and battle tested on production in many sites
- Optional logging based on bunyan

## Installation

### Install globally

```
$ npm i revio -g
$ sudo revio install
```

### Install locally

```
$ npm i revio
```
or
```
$ npm i revio --save
```

## Usage

### Run

```bash
> sudo revio
```

### Config example

`/etc/revio/revio.yml`:

```yaml
server:
  debug: false
  port: 80
  ssl:
    port: 443
    http2: true
  letsencrypt:
    path: '{{base}}/certs'
    port: 9999
    prod: false
    challenge: 'http-01'        # http-01, tls-sni-01, or dns-01
routes:
  - example.com:
      backend: http://172.17.42.1:8080
      ssl:
        letsencrypt:
          email: 'revio@example.com'
  - abc.example.com: http://172.17.42.4:8080
  - abc.example.com/media: http://172.17.42.5:8080
  - balance.me:
      - http://172.17.40.6:8080
      - http://172.17.41.6:8080
      - http://172.17.42.6:8080
      - http://172.17.43.6:8080
  - '*': http://172.17.42.10:8080
```

### Programmatical example

`revio` export `Server` as `ReverseProxy` in `redbird`

```js
const Server = require('revio').Server;

const server = new Server({port: 80});

// OPTIONAL: Setup your server but disable the X-Forwarded-For header
const server = new Server({port: 80, xfwd: false});

// Route to any global ip
server.register("optimalbits.com", "http://167.23.42.67:8000");

// Route to any local ip, for example from docker containers.
server.register("example.com", "http://172.17.42.1:8001");

// Route from hostnames as well as paths
server.register("example.com/static", "http://172.17.42.1:8002");
server.register("example.com/media", "http://172.17.42.1:8003");

// Subdomains, paths, everything just works as expected
server.register("abc.example.com", "http://172.17.42.4:8080");
server.register("abc.example.com/media", "http://172.17.42.5:8080");

// Route to any href including a target path
server.register("foobar.example.com", "http://172.17.42.6:8080/foobar");

// You can also enable load balancing by registering the same hostname with different
// target hosts. The requests will be evenly balanced using a Round-Robin scheme.
server.register("balance.me", "http://172.17.40.6:8080");
server.register("balance.me", "http://172.17.41.6:8080");
server.register("balance.me", "http://172.17.42.6:8080");
server.register("balance.me", "http://172.17.43.6:8080");

// LetsEncrypt support
// With Redbird you can get zero conf and automatic SSL certificates for your domains
server.register('example.com', 'http://172.60.80.2:8082', {
  ssl: {
    letsencrypt: {
      email: 'john@example.com', // Domain owner/admin email
      production: true, // WARNING: Only use this flag when the server is verified to work correctly to avoid being banned!
    }
  }
});

//
// LetsEncrypt requires a minimal web server for handling the challenges, this is by default on port 3000
// it can be configured when initiating the server. This web server is only used by Redbird internally so most of the time
// you  do not need to do anything special other than avoid having other web services in the same host running
// on the same port.

//
// HTTP2 Support using LetsEncrypt for the certificates
//
require('revio').server({  // or using `server` creation function
  letsencrypt: {
    path: __dirname + '/certs',
    port:9999
  },
  ssl: {
    http2: true,
  }
});

```

## About HTTPS

The HTTPS proxy supports virtual hosts by using SNI (which most modern browsers support: IE7 and above).
The proxying is performed by hostname, so you must use the same SSL certificates for a given hostname independently of its paths.

### LetsEncrypt

Some important considerations when using LetsEncrypt. You need to agree to LetsEncrypt [terms of service](https://letsencrypt.org/documents/LE-SA-v1.0.1-July-27-2015.pdf). When using
LetsEncrypt, the obtained certificates will be copied to disk to the specified path. Its your responsibility to backup, or save persistently when applicable. Keep in mind that
these certificates needs to be handled with care so that they cannot be accessed by malicious users. The certificates will be renewed every
2 months automatically forever.

## Docker support

If you use docker, you can tell Redbird to automatically register routes based on image names. You register your image name and then every time a container starts from that image, 
it gets registered, and unregistered if the container is stopped. If you run more than one container from the same image, Redbird will load balance following a round-robin algorithm:

Programmatical example:
```js
const server = require('revio').server({
  port: 8080,
});

require('revio')
  .docker(server)
  .register("example.com", 'company/myimage:latest');
```

Yaml example:

```yaml
docker:
  - example.com: company/myimage:latest
```

## Cluster support

Evoxy support automatic support for node cluster. Just specify in the options object
the number of processes that you want Redbird to use. Redbird will automatically re-start
any thread that may crash automatically, increasing even more its reliability.

Programmatical example:
```js
const server = new require('revio').server({
  port: 8080,
  cluster: 4
});
```

Yaml example:
```yaml
server:
  port: 8080
  cluster: 4
```

## NTLM support

[TBD](https://github.com/OptimalBits/redbird#ntlm-support)

## Custom Resolvers

[TBD](https://github.com/OptimalBits/redbird#custom-resolvers)

## API

[TBD](https://github.com/OptimalBits/redbird#redbirdopts)

## Reference

[Redbird](https://github.com/OptimalBits/redbird)

## License

MIT © [Yuan Tao](https://github.com/taoyuan)
