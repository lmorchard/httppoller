TODO
====

* Detect changes in fetched resources
    * Publish activity stream listing changed resources
    * Outbound webhook-style notifications on changed resources

* Web UI to manage subscriptions, view metrics and reports

* HTTP service to:
    * fetch polled resources
    * add new subscriptions
    * delete existing subscriptions

* HTTP proxy to fetch polled resources
    * GET to a previously-unknown resource results in auto-subscribe
        * Option to return 204 No Content or perform first fetch right then
    * Option to passthrough non-GETs or throw 405 Method Not Allowed
