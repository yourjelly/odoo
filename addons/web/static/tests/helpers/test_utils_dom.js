odoo.define('web.test_utils_dom', function (require) {
"use strict";

var concurrency = require('web.concurrency');

/**
 * DOM Test Utils
 *
 * This module defines various utility functions to help simulate DOM events.
 *
 * Note that all methods defined in this module are exported in the main
 * testUtils file.
 */

/**
 * Returns a promise that will be resolved after the tick after the
 * nextAnimationFrame
 *
 * This is usefull to guarantee that OWL has had the time to render
 *
 * @returns {Promise}
 */
function returnAfterNextAnimationFrame() {
    return new Promise((resolve, reject) => {
        window.requestAnimationFrame(async () => {
            await concurrency.delay(0);
            resolve();
        });
    });
}

/**
 * simulate a drag and drop operation between 2 jquery nodes: $el and $to.
 * This is a crude simulation, with only the mousedown, mousemove and mouseup
 * events, but it is enough to help test drag and drop operations with jqueryUI
 * sortable.
 *
 * @todo: remove the withTrailingClick option when the jquery update branch is
 *   merged.  This is not the default as of now, because handlers are triggered
 *   synchronously, which is not the same as the 'reality'.
 *
 * @param {jQuery|EventTarget} $el
 * @param {jQuery|EventTarget} $to
 * @param {Object} [options]
 * @param {string|Object} [options.position='center'] target position:
 *   can either be one of {'top', 'bottom', 'left', 'right'} or
 *   an object with two attributes (top and left))
 * @param {boolean} [options.disableDrop=false] whether to trigger the drop action
 * @param {boolean} [options.continueMove=false] whether to trigger the
 *   mousedown action (will only work after another call of this function with
 *   without this option)
 * @param {boolean} [options.withTrailingClick=false] if true, this utility
 *   function will also trigger a click on the target after the mouseup event
 *   (this is actually what happens when a drag and drop operation is done)
 * @param {jQuery|EventTarget} [options.mouseenterTarget=undefined] target of the mouseenter event
 * @param {jQuery|EventTarget} [options.mousedownTarget=undefined] target of the mousedown event
 * @param {jQuery|EventTarget} [options.mousemoveTarget=undefined] target of the mousemove event
 * @param {jQuery|EventTarget} [options.mouseupTarget=undefined] target of the mouseup event
 * @param {jQuery|EventTarget} [options.ctrlKey=undefined] if the ctrl key should be considered pressed at the time of mouseup
 * @returns {Promise}
 */
async function dragAndDrop($el, $to, options) {
    let el = null;
    if ($el instanceof EventTarget) {
        el = $el;
        $el = $(el);
    }
    if ($to instanceof EventTarget) {
        $to = $($to);
    }
    options = options || {};
    var position = options.position || 'center';
    var elementCenter = $el.offset();
    var toOffset = $to.offset();

    if (_.isObject(position)) {
        toOffset.top += position.top;
        toOffset.left += position.left;
    } else {
        toOffset.top += $to.outerHeight() / 2;
        toOffset.left += $to.outerWidth() / 2;
        var vertical_offset = (toOffset.top < elementCenter.top) ? -1 : 1;
        if (position === 'top') {
            toOffset.top -= $to.outerHeight() / 2 + vertical_offset;
        } else if (position === 'bottom') {
            toOffset.top += $to.outerHeight() / 2 - vertical_offset;
        } else if (position === 'left') {
            toOffset.left -= $to.outerWidth() / 2;
        } else if (position === 'right') {
            toOffset.left += $to.outerWidth() / 2;
        }
    }

    if ($to[0].ownerDocument !== document) {
        // we are in an iframe
        var bound = $('iframe')[0].getBoundingClientRect();
        toOffset.left += bound.left;
        toOffset.top += bound.top;
    }
    triggerEvent(options.mouseenterTarget || el || $el, 'mouseenter');
    if (!(options.continueMove)) {
        elementCenter.left += $el.outerWidth() / 2;
        elementCenter.top += $el.outerHeight() / 2;

        triggerEvent(options.mousedownTarget || el || $el, 'mousedown', {
            which: 1,
            pageX: elementCenter.left,
            pageY: elementCenter.top
        });
    }

    triggerEvent(options.mousemoveTarget || el || $el, 'mousemove', {
        which: 1,
        pageX: toOffset.left,
        pageY: toOffset.top
    });

    if (!options.disableDrop) {
        triggerEvent(options.mouseupTarget || el || $el, 'mouseup', {
            which: 1,
            pageX: toOffset.left,
            pageY: toOffset.top,
            ctrlKey: options.ctrlKey,
        });
        if (options.withTrailingClick) {
            triggerEvent(options.mouseupTarget || el || $el, 'click');
        }
    } else {
        // It's impossible to drag another element when one is already
        // being dragged. So it's necessary to finish the drop when the test is
        // over otherwise it's impossible for the next tests to drag and
        // drop elements.
        $el.on('remove', async () => {
            triggerEvent($el, 'mouseup');
        });
    }
    return returnAfterNextAnimationFrame();
}

/**
 * simulate a mouse event with a custom event who add the item position. This is
 * sometimes necessary because the basic way to trigger an event (such as
 * $el.trigger('mousemove')); ) is too crude for some uses.
 *
 * @param {jQuery|EventTarget} $el
 * @param {string} type a mouse event type, such as 'mousedown' or 'mousemove'
 * @returns {Promise}
 */
function triggerMouseEvent($el, type) {
    const el = $el instanceof jQuery ? $el[0] : $el;
    if (!el) {
        throw new Error(`no target found to trigger MouseEvent`);
    }
    const rect = el.getBoundingClientRect();
    // little fix since it seems on chrome, it triggers 1px too on the left
    const left = rect.x + 1;
    const top = rect.y;
    return triggerEvent($el, type, {
        which: 1,
        pageX: left, layerX: left, screenX: left,
        pageY: top, layerY: top, screenY: top,
    });
}

/**
 * simulate a mouse event with a custom event on a position x and y. This is
 * sometimes necessary because the basic way to trigger an event (such as
 * $el.trigger('mousemove')); ) is too crude for some uses.
 *
 * @param {integer} x
 * @param {integer} y
 * @param {string} type a mouse event type, such as 'mousedown' or 'mousemove'
 * @returns {HTMLElement}
 */
function triggerPositionalMouseEvent(x, y, type) {
    var ev = document.createEvent("MouseEvent");
    var el = document.elementFromPoint(x, y);
    ev.initMouseEvent(
        type,
        true /* bubble */,
        true /* cancelable */,
        window, null,
        x, y, x, y, /* coordinates */
        false, false, false, false, /* modifier keys */
        0 /*left button*/, null
    );
    el.dispatchEvent(ev);
    return el;
}

/**
 * simulate a keypress event for a given character
 *
 * @param {string} char the character, or 'ENTER'
 * @returns {Promise}
 */
function triggerKeypressEvent(char) {
    var keycode;
    if (char === 'Enter') {
        keycode = $.ui.keyCode.ENTER;
    } else if (char === "Tab") {
        keycode = $.ui.keyCode.TAB;
    } else {
        keycode = char.charCodeAt(0);
    }
    return triggerEvent(document.body, 'keypress', {
        key: char,
        keyCode: keycode,
        which: keycode,
    });
}

/**
 * Click on a specified element. If the option first or last is not specified,
 * this method also check the unicity and the visibility of the target.
 *
 * @param {string|EventTarget|EventTarget[]} el (if string: it is a (jquery) selector)
 * @param {boolean} [options={}] click options
 * @param {boolean} [options.allowInvisible=false] if true, clicks on the
 *   element event if it is invisible
 * @param {boolean} [options.first=false] if true, clicks on the first element
 * @param {boolean} [options.last=false] if true, clicks on the last element
 * @returns {Promise}
 */
async function click(el, options={}) {
    let matches, target;
    let selectorMsg = "";
    let jquery = false;
    if (typeof el === 'string') {
        el = $(el);
    }
    if (el instanceof EventTarget) {
        // EventTarget
        matches = [el];
    } else {
        // Any other itterable object containing EventTarget objects (jQuery, HTMLCollection, etc.)
        if (el instanceof jQuery) {
            jquery = true;
        }
        matches = [...el];
    }

    const validMatches = options.allowInvisible ?
        matches : matches.filter(t => $(t).is(':visible'));

    if (options.first) {
        if (validMatches.length === 1) {
            throw new Error(`There should be more than one visible target ${selectorMsg}.  If` +
                ' you are sure that there is exactly one target, please use the ' +
                'click function instead of the clickFirst function');
        }
        target = validMatches[0];
    } else if (options.last) {
        if (validMatches.length === 1) {
            throw new Error(`There should be more than one visible target ${selectorMsg}.  If` +
                ' you are sure that there is exactly one target, please use the ' +
                'click function instead of the clickLast function');
        }
        target = validMatches[validMatches.length - 1];
    } else if (validMatches.length !== 1) {
        throw new Error(`Found ${validMatches.length} elements to click on, instead of 1 ${selectorMsg}`);
    } else {
        target = validMatches[0];
    }
    if (validMatches.length === 0 && matches.length > 0) {
        throw new Error(`Element to click on is not visible ${selectorMsg}`);
    }
    if (jquery) {
        target = $(target);
    }

    target.click();
    return returnAfterNextAnimationFrame();
}

/**
 * Click on the first element of a list of elements.  Note that if the list has
 * only one visible element, we trigger an error. In that case, it is better to
 * use the click helper instead.
 *
 * @param {string|EventTarget|EventTarget[]} el (if string: it is a (jquery) selector)
 * @param {boolean} [options={}] click options
 * @param {boolean} [options.allowInvisible=false] if true, clicks on the
 *   element event if it is invisible
 * @returns {Promise}
 */
function clickFirst(el, options) {
    return click(el, _.extend({}, options, {first: true}));
}

/**
 * Click on the last element of a list of elements.  Note that if the list has
 * only one visible element, we trigger an error. In that case, it is better to
 * use the click helper instead.
 *
 * @param {string|EventTarget|EventTarget[]} el (if string: it is a (jquery) selector)
 * @param {boolean} [options={}] click options
 * @param {boolean} [options.allowInvisible=false] if true, clicks on the
 *   element event if it is invisible
 * @returns {Promise}
 */
function clickLast(el, options) {
    return click(el, _.extend({}, options, {last: true}));
}

/**
 * Triggers multiple events on the specified element.
 *
 * @param {EventTarget|EventTarget[]} el
 * @param {string[]} events the events you want to trigger
 * @returns {Promise}
 */
async function triggerEvents(el, events) {
    if (el instanceof jQuery) {
        if (el.length !== 1) {
            throw new Error(`target has length ${el.length} instead of 1`);
        }
    }
    if (typeof events === 'string') {
        events = [events];
    }

    for (let e = 0; e < events.length; e ++) {
        await triggerEvent(el, events[e], {});
    }
}

/**
 * Triggers an event on the specified target.
 * This function will dispatch a native event to an EventTarget or a
 * jQuery event to a jQuery object. This behaviour can be overriden by the
 * jquery option.
 *
 * @param {EventTarget|EventTarget[]} el
 * @param {string} eventType event type
 * @param {Object} [eventAttrs] event attributes
 *   on a jQuery element with the `$.fn.trigger` function
 * @returns {Promise}
 */
async function triggerEvent(el, eventType, eventAttrs={}) {
    let matches;
    let selectorMsg = "";
    let jquery = false;
    if (el instanceof EventTarget) {
        // EventTarget
        matches = [el];
    } else {
        // Any other itterable object containing EventTarget objects (jQuery, HTMLCollection, etc.)
        if (el instanceof jQuery) {
            jquery = true;
        }
        matches = [...el];
    }

    if (matches.length !== 1) {
        throw new Error(`Found ${matches.length} elements to trigger "${eventType}" on, instead of 1 ${selectorMsg}`);
    }

    const target = jquery ? $(matches[0]) : matches[0];

    if (target[eventType] && !Object.keys(eventAttrs).length) {
        // Calls the built-in EventTarget or jQuery prototype function
        // e.g. click(), focus(), etc.
        target[eventType]();
    } else if (jquery) {
        // Triggers a jQuery event
        const event = Object.keys(eventAttrs).length ?
            $.Event(eventType, eventAttrs) :
            eventType;
        target.trigger(event);
    } else {
        // Triggers a new native event
        const event = new Event(eventType);
        Object.assign(event, eventAttrs);
        Object.defineProperty(event, 'target', {
            writable: false,
            value: target,
        });
        target.dispatchEvent(event);
    }
    return returnAfterNextAnimationFrame();
}


/**
 * Opens the datepicker of a given element.
 *
 * @param {jQuery} $datepickerEl element to which a datepicker is attached
 */
function openDatepicker($datepickerEl) {
    return click($datepickerEl.find('.o_datepicker_input'));
}


return {
    triggerKeypressEvent: triggerKeypressEvent,
    triggerMouseEvent: triggerMouseEvent,
    triggerPositionalMouseEvent: triggerPositionalMouseEvent,
    dragAndDrop: dragAndDrop,
    openDatepicker: openDatepicker,
    click: click,
    clickFirst: clickFirst,
    clickLast: clickLast,
    triggerEvents: triggerEvents,
    triggerEvent: triggerEvent,
    returnAfterNextAnimationFrame: returnAfterNextAnimationFrame,
};

});
