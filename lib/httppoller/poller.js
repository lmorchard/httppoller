// ## httppoller polling machinery

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    fs = require('fs'),
    
    async = require('async'),
    log = require('winston'),

    url = require('url'),
    http = require('http'),
    https = require('https'),
    request = require('request'),

    _ = require('underscore'),
    Backbone = require('backbone'),
    
    hp_utils = require(__dirname + '/utils'),
    hp_models = require(__dirname + '/models'),
    hp_subscriptions = require(__dirname + '/subscriptions');
    
require('bufferjs/concat');
    
// ### Poller class    
var Poller = module.exports.Poller = hp_utils.mkClass({
    
    default_options: {
        queue_concurrency: 16,
        max_fetch_age: 1000 * 60 * 30, // 30 min
        max_errors: 5
    },

    init: function () {
        this.log = log;
    },

    pollAll: function (next) {
        var $this = this,
            now = (new Date()).getTime();

        $this.poll_queue = async.queue(
            _.bind($this.pollOne, $this),
            $this.options.queue_concurrency
        );
        $this.poll_queue.drain = function () {
            next();
        };

        var subscriptions = new hp_models.SubscriptionCollection();
        subscriptions.fetch({ 
            success: function () {
                subscriptions.each(function (sub, key) {
                    var disabled = sub.get('disabled'),
                        fetch_age = now - sub.get('last_fetched');
                    if (disabled || (fetch_age < $this.options.max_fetch_age)) {
                        return;
                    }
                    $this.poll_queue.push(sub);
                });
            }
        });

        return $this;
    },

    pollOne: function (sub, next) {
        var $this = this,
            now = (new Date()).getTime();

        if (sub.get('disabled')) {
            // Disabled resources get skipped.
            return next();
        }

        // Check whether this resource was fetched recently enough to skip.
        // TODO: Make this adaptive; additive delay increase, multiplicative decrease
        if (now - sub.get('last_fetched') < $this.options.max_fetch_age) {
            $this.log.debug("SKIP " + sub.get('resource_url'));
            return next();
        }
        sub.set('last_fetched', now);

        $this.log.debug("START " + sub.get('resource_url'));

        // Set up request headers for conditional GET, if the right
        // headers from last fetch are available.
        var req_headers = {},
            sub_headers = sub.get('headers');
        if ('last-modified' in sub_headers) {
            req_headers['If-Modified-Since'] = sub_headers['last-modified'];
        }
        if ('etag' in sub_headers) {
            req_headers['If-None-Match'] = sub_headers.etag;
        }

        // Prepare the HTTP GET request.
        var sub_url = sub._temporary_url || sub.get('resource_url');
        var parts = url.parse(sub_url),
            is_ssl = (parts.protocol == 'https:'),
            opts = {
                method: 'GET',
                host: parts.host,
                port: parts.port || (is_ssl ? 443 : 80),
                path: parts.path,
                headers: req_headers
            },
            mod = is_ssl ? https : http;

        var req = mod.request(opts, function (res) {

            // Accumulate chunks of response data.
            var chunks = [];
            res.on('data', function (chunk) {
                chunks.push(chunk);
            });

            // Register handler for request completion.
            res.on('end', function () {

                if (res.statusCode < 400) {
                    $this.log.info("("+res.statusCode+") GET " + sub_url);
                } else {
                    $this.log.error("("+res.statusCode+") GET " + sub_url);
                }

                if (200 == res.statusCode) {
                    sub.set({
                        'status': res.statusCode,
                        'headers': res.headers,
                        'last_error': null
                    });
                    return $this.updateSub(sub, Buffer.concat(chunks), res, next);
                }

                if (301 == res.statusCode || 303 == res.statusCode) {
                    // On a 301 Moved or 303 See Other, change the subscription
                    // URL and queue another fetch after updating DB records.
                    if (res.headers.location && sub_url != res.headers.location) {
                        sub.set({'resource_url': res.headers.location});
                        return $this.updateSub(sub, null, res, function () {
                            $this.poll_queue.push(sub);
                            next();
                        });
                    }
                }

                if (302 == res.statusCode || 307 == res.statusCode) {
                    sub._temporary_url = res.headers.location;
                    $this.poll_queue.push(sub);
                    next();
                }

                if (304 == res.statusCode) {
                    // Skip other updates for 304.
                    return $this.updateSub(sub, null, res, next);
                }

                if (res.statusCode >= 400) {
                    // TODO: Disable resources with 4xx and 5xx
                    sub.set({
                        'status': res.statusCode,
                        'headers': res.headers,
                        'last_error': null
                    });
                    return $this.updateSub(sub, null, res, next);
                }

                next();
            });

        });

        // Register error handler for HTTP GET request.
        req.on('error', function (e) {
            $this.log.error("ERROR "+sub.get('resource_url')+" "+e.code+" "+e);
            sub.set({
                status: 999,
                last_error: ''+e
            });
            return $this.updateSub(sub, null, next);
        });

        // Fire off the HTTP GET request.
        req.end();
    },

    updateSub: function (sub, content, res, next) {
        var $this = this,
            now = (new Date()).getTime();

        // Rotate the status history for this resource
        var h = sub.get('status_history') || [];
        h.unshift([now, sub.get('status')]);
        sub.set({ 'status_history': h.slice(0,10) });

        // Count recent consecutive errors 
        var ct = 0;
        for (var i=0; i<h.length; i++) {
            if (h[i] >= 400) { ct++; }
            else { break; }
        }

        // Update the resource and disable sub if too many errors
        if (ct > $this.options.max_errors) {
            $this.log.error("TOO MANY ERRORS, DISABLING " + sub.url);
            sub.set({'disabled': true});
        }

        if (content) {
            // FIXME: This can't possibly be right, with regard to encodings.
            sub.set({ "content": content.toString('utf-8') });
        }

        sub.save({}, { success: next });
    }

});

// ### Run the poller
module.exports.run = function (next) {
    var poller = new Poller({ });
    var runner = function () {
        log.debug("Polling at " + (new Date()));
        poller.pollAll(next);
        setTimeout(runner, 30 * 1000);
    };
    runner();
};
