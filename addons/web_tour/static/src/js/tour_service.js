odoo.define('web_tour.tour', function (require) {
"use strict";

var rootWidget = require('root.widget');
var rpc = require('web.rpc');
var session = require('web.session');
var TourManager = require('web_tour.TourManager');

const untrackedClassnames = ["o_tooltip", "o_tooltip_content", "o_tooltip_overlay"];

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

        // Use a MutationObserver to detect DOM changes, when a mutation occurs,
        // only add it to the list of mutation to process and delay the
        // mutation processing. We have to record them all so that a change that
        // is undo only a moment later is detected correctly. Most of them
        // will trigger a tip check anyway so, most of the time, processing the
        // first one will be enough to be sure that a tip update has to be done.
        let mutationTimer = undefined;
        let currentMutations = [];
        const observer = new MutationObserver(records => {
            clearTimeout(mutationTimer);
            for (const record of records) {
                const newValue = record.type === 'attributes'
                    ? record.target.getAttribute(record.attributeName)
                    : null;
                currentMutations.push({
                    record: record,
                    oldValue: record.oldValue || '',
                    newValue: newValue || '',
                });
            }
            mutationTimer = setTimeout(() => _processMutations(), 500);
        });
        const tooltipParentRegex = /\bo_tooltip_parent\b/;
        function _processMutations() {
            nextMutation:for (const mutation of currentMutations) {
                // First check if the mutation applied on an element we do not
                // track (like the tour tips themself).
                if (!_isTracked(mutation.record.target)) {
                    continue nextMutation;
                }

                if (mutation.record.type === 'childList') {
                    // If it is a modification to the DOM hierarchy, only
                    // consider the addition/removal of tracked nodes.
                    for (const nodes of [mutation.record.addedNodes, mutation.record.removedNodes]) {
                        for (const node of nodes) {
                            if (!_isTracked(node)) {
                                continue nextMutation;
                            }
                        }
                    }
                } else if (mutation.record.type === 'attributes') {
                    const oldV = mutation.oldValue.trim();
                    const newV = mutation.newValue.trim();

                    // Not sure why but this occurs, especially on ID change
                    // (probably some strange jQuery behavior, see below).
                    // Also sometimes, a class is just considered changed while
                    // it just loses the spaces around the class names.
                    if (oldV === newV) {
                        continue nextMutation;
                    }

                    if (mutation.record.attributeName === 'id') {
                        // Check if this is not an ID change done by jQuery for
                        // performance reasons.
                        if (oldV.includes('sizzle') || newV.includes('sizzle')) {
                            continue nextMutation;
                        }
                    } else if (mutation.record.attributeName === 'class') {
                        // Check if the change is about receiving or losing the
                        // 'o_tooltip_parent' class, which is linked to the tour
                        // service system.
                        const hadClass = tooltipParentRegex.test(oldV);
                        const hasClass = tooltipParentRegex.test(newV);
                        if (hadClass !== hasClass) {
                            continue nextMutation;
                        }
                    }
                }

                // The mutation is a tracked one, update the tour manager and
                // stop here, no need to check the other mutations.
                tour_manager.update();
                break;
            }
            // Either all the mutations have been ignored or one triggered a
            // tour manager update.
            currentMutations = [];
        }
        function _isTracked(node) {
            if (node.classList) {
                for (const className of untrackedClassnames) {
                    if (node.classList.contains(className)) {
                        return false;
                    }
                }
            }
            return true;
        }

        // Now that the observer is configured, we have to start it when needed.
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
