# evoxy [![Build Status](https://travis-ci.org/taoyuan/evoxy.svg?branch=master)](https://travis-ci.org/taoyuan/evoxy)

> A reverse proxy server

## Install

```
$ npm install --save evoxy
```


## Usage

```js
const evoxy = require('evoxy');

evoxy();
```


## API

### evoxy(config)

#### config

Type: `string`

Configuration file path

## CLI

```
$ npm install --global evoxy
```

```
$ evo --help

  Usage: evo [options]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
    -c, --config   configuration file specifying
```

## Creds

* [OptimalBits](https://github.com/OptimalBits)

## License

MIT © [Yuan Tao](https://github.com/taoyuan)
