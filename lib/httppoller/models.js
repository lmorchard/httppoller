// ## httppoller models
var util = require('util'),
    crypto = require('crypto'),
    _ = require('underscore'),
    Backbone = require('backbone');

var Subscription = Backbone.Model.extend({

    defaults: {
        "title": "untitled",
        "resource_url": "",
        "body": "",
        "headers": [],
        "etag": "",
        "last_modified": ""
    },

    hash: function () {
        return crypto
            .createHash('md5')
            .update(this.get('resource_url'))
            .digest('hex');
    },

    url: function () {
        var base_url = SubscriptionCollection.prototype.url(),
            hash = this.hash();
        return base_url + hash;
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
