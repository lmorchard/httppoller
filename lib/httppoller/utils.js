// ## Backbone sync handlers for models
var util = require('util'),
    async = require('async'),
    _ = require('underscore'),
    Backbone = require('backbone');

// ### mkClass: Quick & dirty inheritance thingy
module.exports.mkClass = function () {
    var base = function (options) {
        this.options = options || {};
        _.defaults(this.options, this.default_options);
        return this.init.apply(this, arguments);
    };
    var args = Array.prototype.slice.call(arguments);  
    args.unshift({
        default_options: {},
        init: function () {}
    });
    args.unshift(base.prototype);
    _.extend.apply(_, args);
    return base;
};
