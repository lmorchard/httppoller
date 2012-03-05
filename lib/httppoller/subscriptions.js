// ## httppoller subscriptions

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    fs = require('fs'),
    async = require('async'),
    log = require('winston'),
    _ = require('underscore'),
    hp_models = require(__dirname + '/models');

// ### Import polling subscriptions from an OPML file.
module.exports.importOpml = function (next, fn) {
    log.info("Importing OPML from " + fn);

    var subscriptions = new hp_models.SubscriptionCollection(),
        OpmlParser = require('opmlparser'),
        op = new OpmlParser(),
        ct = 0;

    op.on('feed', function (feed) {
        var sub = subscriptions.create({
            "description": feed.title || feed.text,
            "resource_url": feed.xmlUrl || feed.url
        });
        ct++;
    });

    op.on('end', function (meta, feeds, outline) {
        log.info(ct + " URLs imported");
        next();
    });

    op.parseFile(fn);
};

// ### Import polling subscriptions from a text file listing URLs
module.exports.importTxt = function (next, fn) {
    log.info("Importing from " + fn);

    var subscriptions = new hp_models.SubscriptionCollection(),
        ct = 0;
        
    fs.readFile(fn, 'utf-8', function (err, data) {
        var lines = (''+data).split("\n");
        
        _.each(lines, function (line) {
            line = line.trim();
            var sub = subscriptions.create({
                "resource_url": line
            });
            ct++;
        });

        log.info(ct + " URLs imported");
        next();
    });
};

// ### Add a subscription by URL
module.exports.addSub = function (next, url, description) {
    var subscriptions = new hp_models.SubscriptionCollection();
    subscriptions.create({
        "resource_url": url,
        "description": description
    }, {
        success: function() {
            log.info('Added subscription to ' + url);
            next();
        }
    });
};

// ### List polling subscriptions
module.exports.listSubs = function (next) {
    var subscriptions = new hp_models.SubscriptionCollection();
    subscriptions.fetch({ 
        success: function () {
            var ct = 0;
            subscriptions.each(function (sub, key) {
                log.info("URL: " + sub.id + " " + sub.get('resource_url'));
                ct++;
            });
            next();
        }
    });
};
