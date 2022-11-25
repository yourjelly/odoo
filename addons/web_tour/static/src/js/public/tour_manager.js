odoo.define('web_tour.public.TourManager', function (require) {
'use strict';

// TODO-JCB: This module seems to be not needed because for public pages,
// > public_root waits for the lazyloaded modules before starting the services.

// var tourRegistry = require('web_tour.tour');
// var lazyloader = require('web.public.lazyloader');
// const { patch } = require("@web/core/utils/patch");

// patch(tourRegistry, "web_tour.public", {
//     waitBeforeTourStart() {
//         return this._super()
//             .then(() => lazyloader.allScriptsLoaded)
//             .then((resolve) => setTimeout(resolve));
//     },
// });
});
