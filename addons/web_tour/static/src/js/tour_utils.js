odoo.define('web_tour.utils', function(require) {
"use strict";

const { _legacyIsVisible } = require("@web/core/utils/ui");

function get_first_visible_element($elements) {
    for (var i = 0 ; i < $elements.length ; i++) {
        var $i = $elements.eq(i);
        if (_legacyIsVisible($i[0])) {
            return $i;
        }
    }
    return $();
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

return {
    'get_first_visible_element': get_first_visible_element,
    'get_jquery_element_from_selector' : get_jquery_element_from_selector,
    findTrigger,
    findExtraTrigger,
};

});
