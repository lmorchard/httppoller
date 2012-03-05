// ## Backbone sync handlers for models
var util = require('util'),
    async = require('async'),
    _ = require('underscore'),
    Backbone = require('backbone'),
    uuid = require('node-uuid'),
    hp_utils = require(__dirname + '/utils');

// ### BaseSync: base class for all sync handlers
var BaseSync = hp_utils.mkClass({
    open: function (next) {
        next(this.getSync(), null); 
    },
    close: function (next) {
        next();
    },
    getSync: function () { 
        return _.bind(this.sync, this); 
    },
    sync: function (method, model, options) {
        var now = (new Date()).getTime(),
            noop = function () {};

        options.success = options.success || noop;
        options.error = options.error || noop;
        options.data = ('model' in model) ? null : model.toJSON();

        if ('create' == method) {
            if (!model.id) { 
                model.id = model.attributes.id = uuid.v1();
                // options.data.id = model.id = model.attributes.id = model.hash();
            }
            if (!options.data.created) {
                options.data.created = model.attributes.created = now;
            }
        }
        if ('create' == method || 'update' == method) {
            options.data.modified = model.attributes.modified = now;
        }

        if (options.data) {
            options.data.id = model.id;
        }

        if ('function' == typeof (this['sync_'+method])) {
            // Allow dispatch to methods on the object, if found.
            return this['sync_'+method](model, options);
        } else {
            return error("unimplemented");
        }
    }
});

// TODO: FilesystemSync? key->filename / value->contents
// TODO: CouchdbSync?
// TODO: MySQLSync?
// TODO: RiakSync?

// ### LocmemSync: sync backbone to local memory
var LocmemSync = module.exports.LocmemSync = hp_utils.mkClass(BaseSync.prototype, {
    open: function (next) {
        this.store = {};
        next(this.getSync(), null); 
    },
    sync_create: function (model, options) {
        this.store[model.url()] = options.data;
        return options.success(model, options.data);
    },
    sync_update: function (model, options) {
        this.store[model.url()] = options.data;
        return options.success(model, options.data);
    },
    sync_delete: function (model, options) {
        delete this.store[model.url()];
        return options.success(model, options.data);
    },
    sync_read: function (model, options) {
        if ('model' in model) {
            return options.success(_(this.store).values());
        } else {
            return options.success(this.store[model.url()]);
        }
    }
});

// In-memory cache of opened node-dirty databases
var _dirty_dbs = {};

// ### DirtySync: sync backbone to node-dirty
// Because [backbone-dirty][] has fallen quite a bit out of date.
// [backbone-dirty]: https://github.com/developmentseed/backbone-dirty
var DirtySync = module.exports.DirtySync = hp_utils.mkClass(BaseSync.prototype, {
    open: function (next) {
        var $this = this,
            db_name = this.options.db_name;
        if (db_name in _dirty_dbs) {
            this.db = _dirty_dbs[db_name];
            next($this.getSync(), null); 
        } else {
            this.db = _dirty_dbs[db_name] = require('dirty')(db_name);
            this.db.on('load', function () {
                next($this.getSync(), null); 
            });
        }
    },
    close: function (next) {
        // HACK: This isn't really public API, but so what.
        this.db._flush();
        next(); 
    },
    sync_create: function (model, options) {
        this.db.set(model.url(), options.data, function () {
            return options.success(model, options.data);
        });
    },
    sync_update: function (model, options) {
        this.db.set(model.url(), options.data, function () {
            return options.success(model, options.data);
        });
    },
    sync_delete: function (model, options) {
        this.db.rm(model.url(), function () {
            return options.success(model, options.data);
        });
    },
    sync_read: function (model, options) {
        if ('model' in model) {
            var items = [],
                base_url = model.url(),
                uniq = {};
            this.db.forEach(function (key, val) {
                if (key.indexOf(base_url) === 0) {
                    uniq[key] = val;
                }
            });
            return options.success(_.values(uniq));
        } else {
            var data = this.db.get(model.id);
            return options.success(data);
        }
    }
});
