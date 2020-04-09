odoo.define('web_tour.tour', function (require) {
"use strict";

var config = require('web.config');
var rootWidget = require('root.widget');
var rpc = require('web.rpc');
var session = require('web.session');
var TourManager = require('web_tour.TourManager');

/**
 * @namespace
 * @property {Object} active_tooltips
 * @property {Object} tours
 * @property {Array} consumed_tours
 * @property {String} running_tour
 * @property {Number} running_step_delay
 * @property {'community' | 'enterprise'} edition
 * @property {Array} _log
 */
return session.is_bound.then(function () {
    var defs = [];
    // Load the list of consumed tours and the tip template only if we are admin, in the frontend,
    // tours being only available for the admin. For the backend, the list of consumed is directly
    // in the page source.
    if (session.is_frontend && session.is_admin) {
        var def = rpc.query({
                model: 'web_tour.tour',
                method: 'get_consumed_tours',
            });
        defs.push(def);
    }
    return Promise.all(defs).then(function (results) {
        var consumed_tours = session.is_frontend ? results[0] : session.web_tours;
        var tour_manager = new TourManager(rootWidget, consumed_tours);

        // Use a MutationObserver to detect DOM changes
        var untracked_classnames = ["o_tooltip", "o_tooltip_content", "o_tooltip_overlay"];
        var check_tooltip = _.debounce(function (records) {
            var update = _.some(records, function (record) {
                // First check if the mutation applied on an element we do not
                // track (like the tour tips themself).
                const isTracked = node => {
                    if (node.classList) {
                        for (const className of untracked_classnames) {
                            if (node.classList.contains(className)) {
                                return false;
                            }
                        }
                    }
                    return true;
                };
                if (!isTracked(record.target)
                        || _.some(record.addedNodes, node => !isTracked(node))
                        || _.some(record.removedNodes, node => !isTracked(node))) {
                    return false;
                }

                if (record.type === 'attributes') {
                    // Check if this is not an ID change. Those can be
                    // safely ignored since we normally do not change ids by
                    // ourself (at least no alongside other changes). We need
                    // to ignore them though as jQuery is triggering many of
                    // those for performance reasons.
                    if (record.attributeName === 'id') {
                        console.log(`HERE IS AN ID CHANGE ${record.oldValue} -> ${record.target.id}`);
                        return false;
                    }

                    // Check if the change is about receiving or losing the
                    // 'o_tooltip_parent' class, which is linked to the tour
                    // service system.
                    if (record.attributeName === 'class') {
                        const hadClass = record.oldValue ? record.oldValue.includes('o_tooltip_parent') : false;
                        const hasClass = record.target.classList.contains('o_tooltip_parent');
                        return hadClass === hasClass;
                    }
                }

                return true;
            });
            if (update) { // ignore mutations which concern the tooltips
                tour_manager.update();
            }
        }, 500);
        var observer = new MutationObserver(check_tooltip);
        var start_service = (function () {
            return function (observe) {
                return new Promise(function (resolve, reject) {
                    tour_manager._register_all(observe).then(function () {
                        if (observe) {
                            observer.observe(document.body, {
                                attributes: true,
                                childList: true,
                                subtree: true,
                                attributeOldValue: true,
                            });
                        }
                        resolve();
                    });
                });
            };
        })();

        // Enable the MutationObserver for the admin or if a tour is running, when the DOM is ready
        start_service(session.is_admin || tour_manager.running_tour);

        // Override the TourManager so that it enables/disables the observer when necessary
        if (!session.is_admin) {
            var run = tour_manager.run;
            tour_manager.run = function () {
                var self = this;
                var args = arguments;

                start_service(true).then(function () {
                    run.apply(self, args);
                    if (!self.running_tour) {
                        observer.disconnect();
                    }
                });
            };
            var _consume_tour = tour_manager._consume_tour;
            tour_manager._consume_tour = function () {
                _consume_tour.apply(this, arguments);
                observer.disconnect();
            };
        }
        // helper to start a tour manually (or from a python test with its counterpart start_tour function)
        odoo.startTour = tour_manager.run.bind(tour_manager);
        return tour_manager;
    });
});

});
