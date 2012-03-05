// ## httppoller models
var util = require('util'),
    crypto = require('crypto'),
    _ = require('underscore'),
    Backbone = require('backbone');

var Subscription = Backbone.Model.extend({

    defaults: {
        "resource_url": "",
        "description": "",
        "status": 0,
        "headers": {},
        "body": "",
        "last_error": null,
        "status_history": [],
        "etag": "",
        "last_modified": "",
        "last_fetched": 0,
        "disabled": false
    },

    hash: function () {
        return crypto
            .createHash('md5')
            .update(this.get('resource_url'))
            .digest('hex');
    },

    url: function () {
        var base_url = SubscriptionCollection.prototype.url();
        return base_url + this.id;
    }

});

var SubscriptionCollection = Backbone.Collection.extend({
    model: Subscription,
    url: function () {
        return '/subscriptions/';
    }
});

module.exports = {
    Subscription: Subscription,
    SubscriptionCollection: SubscriptionCollection
};
