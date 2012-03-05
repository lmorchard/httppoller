# httppoller

Things on the web change. This is a service meant to check on things that
change, let others know when things have changed, and make it easy to fetch
those changed things.

In other words, on the web, polling is the poor man's push and this is an
attempt at a semi-general adaptor.

## Setup and Startup

* Install [node.js 0.6.x](http://nodejs.org/docs/v0.6.10/) and [npm](http://npmjs.org/)
* `npm rebuild`
* `npm start`

## Development

* To run the service:
    * `./bin/httppoller run`
* To see what other commands are available (there are many):
    * `./bin/httppoller --help`
* To run tests:
    * `./node_modules/.bin/nodeunit tests`
* To check code quality:
    * `./node_modules/.bin/hint lib tests`
* To generate docs:
    * `./node_modules/.bin/docco lib/kumascript/*.js`

On OS X, [kicker](https://github.com/alloy/kicker) is handy for auto-running
tests and lint on file changes:

    kicker -e'./node_modules/.bin/jshint lib tests' \
           -e'./node_modules/.bin/nodeunit tests' \
           -e'./node_modules/.bin/docco lib/httppoller/*.js' \
           --no-growl \
           lib tests
