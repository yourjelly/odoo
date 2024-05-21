/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { rpc } from "@web/core/network/rpc";
import sOptions from "@web_editor/js/editor/snippets.options";

sOptions.registry.twitter = sOptions.Class.extend({
    /**
     * @override
     */
    start: function () {
        var options = {
            attrs: {
                class: 'btn-primary d-none',
                contenteditable: 'false',
            },
            text: _t("Reload"),
        };
        const params = Object.assign({
            type: 'button',
        }, options.attrs || {});

        let extraClasses = params.class;
        if (extraClasses) {
            extraClasses = extraClasses.replace(/\boe_highlight\b/g, 'btn-primary')
                .replace(/\boe_link\b/g, 'btn-link');
        }
        params.class = 'btn btn-primary d-none ' + (extraClasses || 'btn-secondary');

        const configuration = document.createElement('button');
        for (const key in params) {
            if (params.hasOwnProperty(key)) {
                if (key === 'disabled' && params[key] === undefined) {
                    continue;
                }
                configuration.setAttribute(key, params[key]);
            }
        }

        if (options.text) {
            const textElement = document.createElement('span');
            textElement.textContent = options.text;
            configuration.appendChild(textElement);
        }

        var div = document.createElement('div');
        document.body.appendChild(div);
        div.appendChild(configuration);
        configuration.addEventListener('click', function (ev) {
            ev.preventDefault();
            ev.stopPropagation();
            rpc('/website_twitter/reload');
        });
        this.$target.on('mouseover.website_twitter', function () {
            var $selected = $(this);
            var position = $selected.offset();
            configuration.classList.remove('d-none');
            offset(configuration, {
                top: $selected.outerHeight() / 2
                        + position.top
                        - configuration.offsetHeight / 2,
                left: $selected.outerWidth() / 2
                        + position.left
                        - configuration.offsetWidth / 2,
            });
        }).on('mouseleave.website_twitter', function (e) {
            if (isNaN(e.clientX) || isNaN(e.clientY)) {
                return;
            }
            var current = document.elementFromPoint(e.clientX, e.clientY);
            if (current === configuration) {
                return;
            }
            configuration.classList.add('d-none');
        });
        this.$target.on('click.website_twitter', '.lnk_configure', function (e) {
            window.location = e.currentTarget.href;
        });
        this.trigger_up('widgets_stop_request', {
            $target: this.$target,
        });
        return this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    cleanForSave: function () {
        this.$target.find('.twitter_timeline').empty();
    },
    /**
     * @override
     */
    destroy: function () {
        this._super.apply(this, arguments);
        this.$target.off('.website_twitter');
    },
});

/**
 * Calculates the offset position of the element relative to the document.
 * @param { HTMLElement } elements - Single element or an array of elements.
 * @param {Object} options - Options for calculating the offset
 * @returns {Array|Object} - Offset position(s) of the element
 */
function offset(elements, options) {
    if (!elements.length) {
        elements = [elements];
    }
    if (options) {
        elements.forEach(function (element) {
            setOffset(element, options);
        });
        return;
    }

    const results = [];
    elements.forEach(function (elem) {

        if (!elem) {
            return;
        }

        if (!elem.getClientRects().length) {
            results.push({ top: 0, left: 0 });
        } else {
            const rect = elem.getBoundingClientRect();
            const win = elem.ownerDocument.defaultView;
            results.push({
                top: rect.top + win.pageYOffset,
                left: rect.left + win.pageXOffset
            });
        }
    });

    return results.length === 1 ? results[0] : results;
}

/**
 * Adjusts the position of an element relative to its offset parent or specified coordinates.
 *
 * @param {HTMLElement} elem - The element whose position is to be adjusted.
 * @param {Object} options - An object containing the new top and left positions, 
 * or a function that returns such an object.
 * @param {number} [options.top] - The new top position of the element.
 * @param {number} [options.left] - The new left position of the element.
 * @param {Function} [options.using] - A function to execute after the position is set, 
 * with the calculated position object passed as its argument.
 */
function setOffset(elem, options) {
    let curPosition, curLeft, curCSSTop, curTop, curOffset, curCSSLeft, calculatePosition,
        position = getComputedStyle(elem).position,
        props = {};

    if (position === "static") {
        elem.style.position = "relative";
    }

    curOffset = offset(elem);
    curCSSTop = getComputedStyle(elem).top;
    curCSSLeft = getComputedStyle(elem).left;
    calculatePosition = (position === "absolute" || position === "fixed") &&
        (curCSSTop === "auto" || curCSSLeft === "auto");

    if (calculatePosition) {
        curPosition = Position(elem);
        curTop = curPosition.top;
        curLeft = curPosition.left;
    } else {
        curTop = parseFloat(curCSSTop) || 0;
        curLeft = parseFloat(curCSSLeft) || 0;
    }

    if (typeof options === 'function') {
        options = options(elem, Object.assign({}, curOffset));
    }

    if (options.top != null) {
        props.top = (options.top - curOffset.top) + curTop;
    }
    if (options.left != null) {
        props.left = (options.left - curOffset.left) + curLeft;
    }

    if (typeof options.using === 'function') {
        options.using(elem, props);
    } else {
        Object.keys(props).forEach(function(key) {
            elem.style[key] = props[key] + 'px';
        });
    }
}

/**
 * Calculates the position of an element relative to the viewport, adjusted for margins.
 *
 * @param {HTMLElement} el - The element whose position is to be calculated.
 * @returns {Object} - An object containing the adjusted top and left positions.
 *                      - top: The top position of the element, adjusted for the margin-top.
 *                      - left: The left position of the element, adjusted for the margin-left.
 */
function Position(el) {
    const {top, left} = el.getBoundingClientRect();
    const {marginTop, marginLeft} = getComputedStyle(el);
    return {
        top: top - parseInt(marginTop, 10),
        left: left - parseInt(marginLeft, 10)
    };
}
