//
// ## httppoller runner
//

/*jshint node: true, expr: false, boss: true */

// ### Prerequisites
var util = require('util'),
    fs = require('fs'),
    
    async = require('async'),
    nconf = require('nconf'),
    log = require('winston'),
    prog = require('commander'),

    _ = require('underscore'),
    Backbone = require('backbone'),
    
    httppoller = require(__dirname),
    hp_models = httppoller.models,
    hp_models_sync = httppoller.models_sync,
    
    base_dir = process.cwd();

// Evil storage global. 
// TODO: Do something else?
var storage;

// ### Main CLI driver
function main (argv) {
    prog.version('0.0.1')
        .option('-c, --config <filename>', 'Load config from <filename>');

    prog.command('import-opml [filename]')
        .description('Import from OPML')
        .action(init(handleImportOpml));

    prog.command('import [filename]')
        .description('Import from text file listing URLs')
        .action(init(handleImportTxt));

    prog.command('list-subs')
        .description('List subscriptions')
        .action(init(handleListSubs));

    prog.command('run')
        .description('Run the polling service')
        .action(init(handleRunService));

    prog.parse(argv);
}

// ### Initialize command
// Wrap a command handler with common initialization preamble.
function init (cmd_next) {
    var $this = this;
    return function () {
        var args = Array.prototype.slice.call(arguments);  
        async.waterfall([
            initConfig,
            initStorage,
            initLogging,
            function (next) {
                args.unshift(next);
                cmd_next.apply($this, args);
            }
        ], shutdown);
    };
}

// ### Initialize configuration
function initConfig (next) {
    var cwd = process.cwd(),
        conf_fns = [
            __dirname + '/../../conf/defaults.json',
            cwd + '/httppoller_config.json',
            cwd + '/httppoller_config_local.json',
            prog.config
        ];
    _.each(conf_fns, function (conf_fn) {
        try {
            if (conf_fn && fs.statSync(conf_fn).isFile()) {
                nconf.file({ file: conf_fn });
            }
        } catch (e) { }
    });
    next();
}

// ### Initialize storage engine
function initStorage (next) {
    var storage_conf = nconf.get('storage'),
        storage_cls = hp_models_sync[storage_conf.driver];
    storage = new storage_cls(storage_conf.options);
    storage.open(function (sync, err) {
        Backbone.sync = sync;
        next();
    });
}

// ### Initialize logging
function initLogging (next) {
    next();
}

// ### Shut down the program
// Close storage and do whatever else needs cleaning up.
function shutdown () {
    storage.close(function () {
    });
}

// ### Import polling subscriptions from an OPML file.
function handleImportOpml (next, fn) {
    log.info("Importing OPML from " + fn);

    var subscriptions = new hp_models.SubscriptionCollection(),
        OpmlParser = require('opmlparser'),
        op = new OpmlParser(),
        ct = 0;

    op.on('feed', function (feed) {
        var sub = subscriptions.create({
            "title": feed.title || feed.text,
            "resource_url": feed.xmlUrl || feed.url
        });
        ct++;
    });

    op.on('end', function (meta, feeds, outline) {
        log.info(ct + " URLs imported");
        next();
    });

    op.parseFile(fn);
}

// ### Import polling subscriptions from a text file listing URLs
function handleImportTxt (next, fn) {
    log.info("Importing from " + fn);

    var subscriptions = new hp_models.SubscriptionCollection(),
        ct = 0;
        
    fs.readFile(fn, 'utf-8', function (err, data) {
        var lines = (''+data).split("\n");
        
        _.each(lines, function (line) {
            line = line.trim();
            var sub = subscriptions.create({
                "title": line,
                "resource_url": line
            });
            ct++;
        });

        log.info(ct + " URLs imported");
        next();
    });
}

// ### List polling subscriptions
function handleListSubs (next) {
    var subscriptions = new hp_models.SubscriptionCollection();
    subscriptions.fetch({ 
        success: function () {
            var ct = 0;
            subscriptions.each(function (sub, key) {
                log.info("URL: " + sub.get('resource_url'));
                ct++;
            });
            log.info("RECS %s", ct);
            next();
        }
    });
}

// ### Run the polling service
function handleRunService (next) {
    next();
}

// Was this module run as a script?
if (require.main === module) {
    // Execute the main driver, if this module is run directly as a script.
    main(process.argv);
} else {
    // Otherwise, export the main driver to be executed by a manager.
    module.exports = main;
}
