odoo.define("bus.tour", function (require) {
    "use strict";

    const tour = require("web_tour.tour");

    // No steps: this tour only makes a request to
    // /web to trigger all the mocked python methods
    // server side
    tour.register("bundle_changed_notification", {
        test: true,
        url: '/web',
    });
});
