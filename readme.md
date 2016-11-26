# evoxy [![Build Status](https://travis-ci.org/taoyuan/evoxy.svg?branch=master)](https://travis-ci.org/taoyuan/evoxy)

> A reverse proxy server based on redbird


## Install

```
$ npm install --save evoxy
```


## Usage

```js
const evoxy = require('evoxy');

evoxy('unicorns');
//=> 'unicorns & rainbows'
```


## API

### evoxy(input, [options])

#### input

Type: `string`

Lorem ipsum.

#### options

##### foo

Type: `boolean`<br>
Default: `false`

Lorem ipsum.


## CLI

```
$ npm install --global evoxy
```

```
$ evoxy --help

  Usage
    evoxy [input]

  Options
    --foo  Lorem ipsum [Default: false]

  Examples
    $ evoxy
    unicorns & rainbows
    $ evoxy ponies
    ponies & rainbows
```


## License

MIT © [Yuan Tao](https://github.com/taoyuan)
