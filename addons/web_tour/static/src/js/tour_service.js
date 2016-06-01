odoo.define('web_tour.tour', function(require) {
"use strict";

var session = require('web.session');
var TourManager = require('web_tour.TourManager');

return $.when(session.is_bound).then(function () {
    var tour = new TourManager(session.web_tours);

    $(function () {
        var check_tooltip = _.throttle(function (records) {
            if (records.length === 1 && records[0].target.className === 'o_tooltip') return;
            tour.update();
        }, 500, {leading: false});
        var observer = new MutationObserver(check_tooltip);
        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
        });
    });

    return tour;
});

});
