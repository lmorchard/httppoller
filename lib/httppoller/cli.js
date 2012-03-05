// ## httppoller runner

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
    hp_models = require(__dirname + '/models'),
    hp_models_sync = require(__dirname + '/models-sync'),
    hp_subscriptions = require(__dirname + '/subscriptions'),
    hp_poller = require(__dirname + '/poller');

// Evil storage global. 
// TODO: Do something else?
var storage;

// ### Main CLI driver
function main (argv) {
    prog.version('0.0.1')
        .option('-c, --config <filename>', 'Load config from <filename>');

    prog.command('list-subs')
        .description('List subscriptions')
        .action(init(hp_subscriptions.listSubs));

    prog.command('add-sub [url] <description>')
        .description('Add a subscription to [url], with optional description')
        .action(init(hp_subscriptions.addSub));

    prog.command('import-opml [filename]')
        .description('Import from OPML')
        .action(init(hp_subscriptions.importOpml));

    prog.command('import [filename]')
        .description('Import from text file listing URLs')
        .action(init(hp_subscriptions.importTxt));

    // TODO: Add one subscription by URL from CLI
    // TODO: Remove one subscription by URL

    prog.command('run')
        .description('Run the polling service')
        .action(init(hp_poller.run));

    prog.parse(argv);
}

// ### Initialize command
// Wrap a command handler with common initialization preamble.
function init (cmd_next) {
    return function () {
        var args = Array.prototype.slice.call(arguments);  
        async.waterfall([
            initConfig,
            initStorage,
            initLogging,
            function (next) {
                args.unshift(next);
                cmd_next.apply(null, args);
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
        Backbone.storage = storage;
        next();
    });
}

// ### Initialize logging
function initLogging (next) {
    log.remove(log.transports.Console);
    log.add(log.transports.Console, {
        colorize: true,
        timestamp: false
    });
    next();
}

// ### Shut down the program
// Close storage and do whatever else needs cleaning up.
function shutdown () {
    storage.close(function () {});
}

// Was this module run as a script?
if (require.main === module) {
    // Execute the main driver, if this module is run directly as a script.
    main(process.argv);
} else {
    // Otherwise, export the main driver to be executed by a manager.
    module.exports = main;
}
