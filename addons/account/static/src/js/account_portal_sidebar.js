odoo.define('account.o_account_portal_sidebar', function(require) {
    'use strict';

    require('web.dom_ready');
    var time = require('web.time');

    if (!$('.o_portal_sidebar').length) {
        return $.Deferred().reject("DOM doesn't contain '.o_portal_sidebar'");
    }

    $('timeago.timeago').each(function(index, el) {
        var datetime = $(el).attr('datetime'),
            datetime_obj = time.str_to_date(datetime),
            // if presentation 365 days, 24 hours, 60 min, 60 second, 1000 millis old(one week)
            // then return fix formate string else timeago
            display_str = "";
        if (datetime_obj && datetime_obj.getTime() - new Date().getTime() > 365 * 24 * 60 * 60 * 1000) {
            display_str = datetime_obj.toDateString();
        } else {
            display_str = moment(datetime_obj).fromNow();
        }
        $(el).text(display_str);
    });

});