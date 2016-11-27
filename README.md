# evoxy [![Build Status](https://travis-ci.org/taoyuan/evoxy.svg?branch=master)](https://travis-ci.org/taoyuan/evoxy)

> A reverse proxy server. Evolved from [Redbird](https://github.com/OptimalBits/redbird). With built in Cluster, HTTP2, LetsEncrypt and Docker support 


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
$ npm i evoxy -g
```

### Install locally

```
$ npm i evoxy --save
```

## Usage

### Example programmatical

`evoxy` export `Reverser` as `ReverseProxy` in `redbird`

```js
const Reverser = require('evoxy').Reverser;

const proxy = new Reverser({port: 80});

// OPTIONAL: Setup your proxy but disable the X-Forwarded-For header
const proxy = new Reverser({port: 80, xfwd: false});

// Route to any global ip
proxy.register("optimalbits.com", "http://167.23.42.67:8000");

// Route to any local ip, for example from docker containers.
proxy.register("example.com", "http://172.17.42.1:8001");

// Route from hostnames as well as paths
proxy.register("example.com/static", "http://172.17.42.1:8002");
proxy.register("example.com/media", "http://172.17.42.1:8003");

// Subdomains, paths, everything just works as expected
proxy.register("abc.example.com", "http://172.17.42.4:8080");
proxy.register("abc.example.com/media", "http://172.17.42.5:8080");

// Route to any href including a target path
proxy.register("foobar.example.com", "http://172.17.42.6:8080/foobar");

// You can also enable load balancing by registering the same hostname with different
// target hosts. The requests will be evenly balanced using a Round-Robin scheme.
proxy.register("balance.me", "http://172.17.40.6:8080");
proxy.register("balance.me", "http://172.17.41.6:8080");
proxy.register("balance.me", "http://172.17.42.6:8080");
proxy.register("balance.me", "http://172.17.43.6:8080");

// LetsEncrypt support
// With Redbird you can get zero conf and automatic SSL certificates for your domains
proxy.register('example.com', 'http://172.60.80.2:8082', {
	ssl: {
    letsencrypt: {
      email: 'john@example.com', // Domain owner/admin email
      production: true, // WARNING: Only use this flag when the proxy is verified to work correctly to avoid being banned!
    }
  }
});

//
// LetsEncrypt requires a minimal web server for handling the challenges, this is by default on port 3000
// it can be configured when initiating the proxy. This web server is only used by Redbird internally so most of the time
// you  do not need to do anything special other than avoid having other web services in the same host running
// on the same port.

//
// HTTP2 Support using LetsEncrypt for the certificates
//
const proxy = new Reverser({
  letsencrypt: {
    path: __dirname + '/certs',
    port:9999
  },
  ssl: {
    http2: true,
  }
});

```

### Example with `/etc/evoxy/evoxy.yml`

```yaml
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
      backend: http://127.0.0.1:8080
      ssl:
        letsencrypt:
          email: 'evoxy@example.com'
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

[TBD](https://github.com/OptimalBits/redbird#docker-support)

## Cluster support

[TBD](https://github.com/OptimalBits/redbird#cluster-support)

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
