odoo.define('web_tour.utils', function(require) {
"use strict";

const { _legacyIsVisible } = require("@web/core/utils/ui");

function get_step_key(name) {
    return 'tour_' + name + '_step';
}

function get_running_key() {
    return 'running_tour';
}

function get_debugging_key(name) {
    return `debugging_tour_${name}`;
}

function get_running_delay_key() {
    return get_running_key() + "_delay";
}

function get_first_visible_element($elements) {
    for (var i = 0 ; i < $elements.length ; i++) {
        var $i = $elements.eq(i);
        if (_legacyIsVisible($i[0])) {
            return $i;
        }
    }
    return $();
}

function do_before_unload(if_unload_callback, if_not_unload_callback) {
    if_unload_callback = if_unload_callback || function () {};
    if_not_unload_callback = if_not_unload_callback || if_unload_callback;

    var old_before = window.onbeforeunload;
    var reload_timeout;
    window.onbeforeunload = function () {
        clearTimeout(reload_timeout);
        window.onbeforeunload = old_before;
        if_unload_callback();
        if (old_before) return old_before.apply(this, arguments);
    };
    reload_timeout = _.defer(function () {
        window.onbeforeunload = old_before;
        if_not_unload_callback();
    });
}

function get_jquery_element_from_selector(selector) {
    const iframeSplit = _.isString(selector) && selector.match(/(.*\biframe[^ ]*)(.*)/);
    if (iframeSplit && iframeSplit[2]) {
        var $iframe = $(`${iframeSplit[1]}:not(.o_ignore_in_tour)`);
        if ($iframe.is('[is-ready="false"]')) {
            return $();
        }
        var $el = $iframe.contents()
            .find(iframeSplit[2]);
        $el.iframeContainer = $iframe[0];
        return $el;
    } else {
        return $(selector);
    }
}

/**
 * If `inModal` is not false (e.g. true or undefined),
 * find `selector` from the top most visible modal.
 * Otherwise, find `selector` from the whole document.
 *
 * @param {string} selector - any valid jquery selector
 * @param {boolean} inModal
 * @returns {Element | undefined}
 */
 function findTrigger(selector, inModal) {
    const $visibleModal = $(".modal:visible").last();
    let $el;
    if (inModal !== false && $visibleModal.length) {
        $el = $visibleModal.find(selector);
    } else {
        $el = get_jquery_element_from_selector(selector);
    }
    return get_first_visible_element($el).get(0);
}

function findExtraTrigger(selector) {
    const $el = get_jquery_element_from_selector(selector);
    return get_first_visible_element($el).get(0)
}

// TODO-JCB: Remove this. Temporarily used for debugging.
window.findTrigger = findTrigger;

function _isTrackedNode(node) {
    if (node.classList) {
        return !untrackedClassnames
            .some(className => node.classList.contains(className));
    }
    return true;
}

const untrackedClassnames = ["o_tooltip", "o_tooltip_content", "o_tooltip_overlay"];
const classSplitRegex = /\s+/g;
const tooltipParentRegex = /\bo_tooltip_parent\b/;

function hasTrackedMutations(mutations) {
    return mutations && mutations.some((mutation) => {
        // First check if the mutation applied on an element we do not
        // track (like the tour tips themself).
        if (!_isTrackedNode(mutation.target)) {
            return false;
        }

        if (mutation.type === "characterData") {
            return true;
        }

        if (mutation.type === "childList") {
            // If it is a modification to the DOM hierarchy, only
            // consider the addition/removal of tracked nodes.
            for (const nodes of [mutation.addedNodes, mutation.removedNodes]) {
                for (const node of nodes) {
                    if (_isTrackedNode(node)) {
                        return true;
                    }
                }
            }
            return false;
        } else if (mutation.type === "attributes") {
            // Get old and new value of the attribute. Note: as we
            // compute the new value after a setTimeout, this might not
            // actually be the new value for that particular mutation
            // record but this is the one after all mutations. This is
            // normally not an issue: e.g. "a" -> "a b" -> "a" will be
            // seen as "a" -> "a" (not "a b") + "a b" -> "a" but we
            // only need to detect *one* tracked mutation to know we
            // have to update tips anyway.
            const oldV = mutation.oldValue ? mutation.oldValue.trim() : "";
            const newV = (mutation.target.getAttribute(mutation.attributeName) || "").trim();

            // Not sure why but this occurs, especially on ID change
            // (probably some strange jQuery behavior, see below).
            // Also sometimes, a class is just considered changed while
            // it just loses the spaces around the class names.
            if (oldV === newV) {
                return false;
            }

            if (mutation.attributeName === "id") {
                // Check if this is not an ID change done by jQuery for
                // performance reasons.
                return !(oldV.includes("sizzle") || newV.includes("sizzle"));
            } else if (mutation.attributeName === "class") {
                // Check if the change is *only* about receiving or
                // losing the 'o_tooltip_parent' class, which is linked
                // to the tour service system. We have to check the
                // potential addition of another class as we compute
                // the new value after a setTimeout. So this case:
                // 'a' -> 'a b' -> 'a b o_tooltip_parent' produces 2
                // mutation records but will be seen here as
                // 1) 'a' -> 'a b o_tooltip_parent'
                // 2) 'a b' -> 'a b o_tooltip_parent'
                const hadClass = tooltipParentRegex.test(oldV);
                const newClasses = mutation.target.classList;
                const hasClass = newClasses.contains("o_tooltip_parent");
                return !(
                    hadClass !== hasClass &&
                    Math.abs(oldV.split(classSplitRegex).length - newClasses.length) === 1
                );
            }
        }

        return true;
    });
};

return {
    get_debugging_key: get_debugging_key,
    'get_step_key': get_step_key,
    'get_running_key': get_running_key,
    'get_running_delay_key': get_running_delay_key,
    'get_first_visible_element': get_first_visible_element,
    'do_before_unload': do_before_unload,
    'get_jquery_element_from_selector' : get_jquery_element_from_selector,
    findTrigger,
    findExtraTrigger,
    hasTrackedMutations,
};

});

