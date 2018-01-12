odoo.define('account.AccountPortalSidebar', function (require) {
"use strict";

require('portal.PortalSidebar');
require('web.dom_ready');
var time = require('web.time');

if (!$('.o_portal_sidebar').length) {
    return $.Deferred().reject("DOM doesn't contain '.o_portal_sidebar'");
}
// Timeago is a jQuery plugin that makes it easy to support automatically updating fuzzy timestamps
// e.g. "4 minutes ago" or "about 1 day ago"
$("timeago.timeago").each(function (index, el) {
    var dateTime = $(el).attr('datetime'),
        dateTimeObj = time.str_to_date(dateTime),
        // if invoice due date 365 days, 24 hours, 60 min, 60 second, 1000 millis old(one week)
        // then return fix formate string else timeago
        displayStr = "";
    if (dateTimeObj && new Date().getTime() - dateTimeObj.getTime() > 365 * 24 * 60 * 60 * 1000) {
        displayStr = dateTimeObj.toDateString();
    } else {
        displayStr = moment(dateTimeObj).fromNow();
    }
    $(el).text(displayStr);
});
});
