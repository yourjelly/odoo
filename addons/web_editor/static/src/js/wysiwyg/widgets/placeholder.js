odoo.define('wysiwyg.widgets.Placeholder', function (require) {
'use strict';

const core = require('web.core');
const OdooEditorLib = require('@web_editor/../lib/odoo-editor/src/OdooEditor');
const Widget = require('web.Widget');
const {isColorGradient} = require('web_editor.utils');

const getDeepRange = OdooEditorLib.getDeepRange;
const getInSelection = OdooEditorLib.getInSelection;
const _t = core._t;

/**
 * Allows to customize placeholder content and style.
 */
const Placeholder = Widget.extend({
    xmlDependencies: ['/web_editor/static/src/xml/wysiwyg.xml'],
    events: {
        'input': '_onAnyChange',
        'change': '_onAnyChange',
    },

    /**
     * @constructor
     * @param {Boolean} data.isButton - whether if the target is a button element.
     */
    init: function (parent, options, editable, data, $button, placeholder) {
        this.options = options || {};
        this._super(parent, _.extend({
            title: _t("Placeholder to"),
        }, this.options));

        this._setPlaceholderContent = true;

        this.data = data || {};
        this.isButton = this.data.isButton;
        this.$button = $button;
        this.noFocusValue = this.options.noFocusValue;

        this.data.className = this.data.className || "";
        this.data.iniClassName = this.data.iniClassName || "";
        this.needLabel = this.data.needLabel || false;

        // Using explicit type 'placeholder' to preserve style when the target is <button class="...btn-placeholder"/>.
        this.colorsData = [
            {type: this.isButton ? 'placeholder' : '', label: _t("Placeholder"), btnPreview: 'placeholder'},
            {type: 'primary', label: _t("Primary"), btnPreview: 'primary'},
            {type: 'secondary', label: _t("Secondary"), btnPreview: 'secondary'},
            {type: 'custom', label: _t("Custom"), btnPreview: 'custom'},
            // Note: by compatibility the dialog should be able to remove old
            // colors that were suggested like the BS status colors or the
            // alpha -> epsilon classes. This is currently done by removing
            // all btn-* classes anyway.
        ];

        this.editable = editable;
        this.$editable = $(editable);

        if (placeholder) {
            const range = document.createRange();
            range.selectNodeContents(placeholder);
            this.data.range = range;
            this.$placeholder = $(placeholder);
            this.placeholderEl = placeholder;
        } else {
            const selection = editable && editable.ownerDocument.getSelection();
            this.data.range = selection && selection.rangeCount && selection.getRangeAt(0);
        }

        if (this.data.range) {
            this.$placeholder = this.$placeholder || $(OdooEditorLib.getInSelection(this.editable.ownerDocument, 'a'));
            this.placeholderEl = this.$placeholder[0];
            this.data.iniClassName = this.$placeholder.attr('class') || '';
            this.colorCombinationClass = false;
            let $node = this.$placeholder;
            while ($node.length && !$node.is('body')) {
                const className = $node.attr('class') || '';
                const m = className.match(/\b(o_cc\d+)\b/g);
                if (m) {
                    this.colorCombinationClass = m[0];
                    break;
                }
                $node = $node.parent();
            }
            const placeholderNode = this.$placeholder[0] || this.data.range.cloneContents();
            const placeholderText = placeholderNode.textContent;
            this.data.content = placeholderText.replace(/[ \t\r\n]+/g, ' ');
            this.data.originalText = this.data.content;
            if (placeholderNode instanceof DocumentFragment) {
                this.data.originalHTML = $('<fakeEl>').append(placeholderNode).html();
            } else {
                this.data.originalHTML = placeholderNode.innerHTML;
            }
            this.data.value = this.$placeholder.attr('t-out') || '';
            this.data.condition = this.$placeholder.attr('t-if') || '';
        } else {
            this.data.content = this.data.content ? this.data.content.replace(/[ \t\r\n]+/g, ' ') : '';
        }

        if (!this.data.url) {
            const urls = this.data.content.match(OdooEditorLib.URL_REGEX_WITH_INFOS);
            if (urls) {
                this.data.url = urls[0];
            }
        }

        if (this.placeholderEl) {
            this.data.isNewWindow = this.data.isNewWindow || this.placeholderEl.target === '_blank';
        }

        const allBtnColorPrefixes = /(^|\s+)(bg|text|border)(-[a-z0-9_-]*)?/gi;
        const allBtnClassSuffixes = /(^|\s+)btn(?!-block)(-[a-z0-9_-]*)?/gi;
        const allBtnShapes = /\s*(rounded-circle|flat)\s*/gi;
        this.data.className = this.data.iniClassName
            .replace(allBtnColorPrefixes, ' ')
            .replace(allBtnClassSuffixes, ' ')
            .replace(allBtnShapes, ' ');
        // 'o_submit' class will force anchor to be handled as a button in placeholderdialog.
        if (/(?:s_website_form_send|o_submit)/.test(this.data.className)) {
            this.isButton = true;
        }
    },
    /**
     * @override
     */
    start: function () {
        for (const option of this._getPlaceholderOptions()) {
            const $option = $(option);
            const value = $option.is('input') ? $option.val() : $option.data('value');
            let active = false;
            if (value) {
                const subValues = value.split(',');
                let subActive = true;
                for (let subValue of subValues) {
                    const classPrefix = new RegExp('(^|btn-| |btn-outline-|btn-fill-)' + subValue);
                    subActive = subActive && classPrefix.test(this.data.iniClassName);
                }
                active = subActive;
            } else {
                active = !this.data.iniClassName || this.data.iniClassName.includes('btn-placeholder') || !this.data.iniClassName.includes('btn-');
            }
            this._setSelectOption($option, active);
        }

        this._updateOptionsUI();

        if (!this.noFocusValue) {
            this.focusValue();
        }

        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Apply the new placeholder to the DOM (via `this.$placeholder`).
     *
     * @param {object} data
     */
    applyPlaceholderToDom: function (data) {
        const attrs = Object.assign({}, this.data.oldAttributes);
        attrs['t-out'] = data.value;
        attrs['t-if'] = data.condition;

        this.$placeholder.attr(attrs);
        this._updatePlaceholderContent(this.$placeholder, data);
    },
    /**
     * Return the placeholder element to edit. Create one from selection if none was
     * present in selection.
     *
     * @param {Node} editable
     * @returns {Node}
     */
    getOrCreatePlaceholder: function (editable) {
        const doc = editable.ownerDocument;
        this.needLabel = this.needLabel || false;
        let placeholder = getInSelection(doc, 't');
        const $placeholder = $(placeholder);
        const range = getDeepRange(editable, {splitText: true, select: true, correctTripleClick: true});
        if (placeholder && (!$placeholder.has(range.startContainer).length || !$placeholder.has(range.endContainer).length)) {
            // Expand the current placeholder to include the whole selection.
            let before = placeholder.previousSibling;
            while (before !== null && range.intersectsNode(before)) {
                placeholder.insertBefore(before, placeholder.firstChild);
                before = placeholder.previousSibling;
            }
            let after = placeholder.nextSibling;
            while (after !== null && range.intersectsNode(after)) {
                placeholder.appendChild(after);
                after = placeholder.nextSibling;
            }
        } else if (!placeholder) {
            placeholder = document.createElement('t');
            if (range.collapsed) {
                range.insertNode(placeholder);
                this.needLabel = true;
            } else {
                placeholder.appendChild(range.extractContents());
                range.insertNode(placeholder);
            }
        }
        return placeholder;
    },
    /**
     * Focuses the value input.
     */
    focusValue() {
        const valueInput = this.el.querySelector('input[name="value"]');
        valueInput.focus();
        valueInput.select();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Abstract method: adapt the placeholder to changes.
     *
     * @abstract
     * @private
     */
    _adaptPreview: function () {},
    /**
     * Abstract method: return true if the URL should be stripped of its domain.
     *
     * @abstract
     * @private
     * @returns {boolean}
     */
    _doStripDomain: function () {},
    /**
     * Get the placeholder's data (url, content and styles).
     *
     * @private
     * @returns {Object} {content: String, url: String, classes: String, isNewWindow: Boolean}
     */
    _getData: function () {
        var $value = this.$('input[name="value"]');
        var value = $value.val();
        var condition = this.$('input[name="condition"]').val();

        if (!value) {
            return null;
        }

        return {
            condition: condition,
            value: value,
        };
    },
    /**
     * Return a list of all the descendants of a given element.
     *
     * @private
     * @param {Node} rootNode
     * @returns {Node[]}
     */
    _getDescendants: function (rootNode) {
        const nodes = [];
        for (const node of rootNode.childNodes) {
            nodes.push(node);
            nodes.push(...this._getDescendants(node));
        }
        return nodes;
    },
    /**
     * Abstract method: return a JQuery object containing the UI elements
     * holding the styling options of the placeholder (eg: color, size, shape).
     *
     * @abstract
     * @private
     * @returns {JQuery}
     */
    _getPlaceholderOptions: function () {},
    /**
     * Abstract method: return the shape(s) to apply to the placeholder (eg:
     * "outline", "rounded-circle", "outline,rounded-circle").
     *
     * @abstract
     * @private
     * @returns {string}
     */
    _getPlaceholderShape: function () {},
    /**
     * Abstract method: return the size to apply to the placeholder (eg:
     * "sm", "lg").
     *
     * @private
     * @returns {string}
     */
    _getPlaceholderSize: function () {},
    /**
     * Abstract method: return the type to apply to the placeholder (eg:
     * "primary", "secondary").
     *
     * @private
     * @returns {string}
     */
    _getPlaceholderType: function () {},
    /**
     * Returns the custom text color for custom type.
     *
     * @abstract
     * @private
     * @returns {string}
     */
    _getPlaceholderCustomTextColor: function () {},
    /**
     * Returns the custom border color for custom type.
     *
     * @abstract
     * @private
     * @returns {string}
     */
    _getPlaceholderCustomBorder: function () {},
    /**
     * Returns the custom border width for custom type.
     *
     * @abstract
     * @private
     * @returns {string}
     */
    _getPlaceholderCustomBorderWidth: function () {},
    /**
     * Returns the custom border style for custom type.
     *
     * @abstract
     * @private
     * @returns {string}
     */
    _getPlaceholderCustomBorderStyle: function () {},
    /**
     * Returns the custom fill color for custom type.
     *
     * @abstract
     * @private
     * @returns {string}
     */
    _getPlaceholderCustomFill: function () {},
    /**
     * Returns the custom text, fill and border color classes for custom type.
     *
     * @abstract
     * @private
     * @returns {string}
     */
    _getPlaceholderCustomClasses: function () {},
    /**
     * Abstract method: return true if the placeholder should open in a new window.
     *
     * @abstract
     * @private
     * @returns {boolean}
     */
    _isNewWindow: function (url) {},
    /**
     * Abstract method: mark one or several options as active or inactive.
     *
     * @abstract
     * @private
     * @param {JQuery} $option
     * @param {boolean} [active]
     */
    _setSelectOption: function ($option, active) {},
    /**
     * Update the placeholder content.
     *
     * @private
     * @param {JQuery} $placeholder
     * @param {object} placeholderInfos
     * @param {boolean} force
     */
    _updatePlaceholderContent($placeholder, placeholderInfos, { force = false } = {}) {
        if (force || (this._setPlaceholderContent && (placeholderInfos.content !== this.data.originalText || placeholderInfos.url !== this.data.url))) {
            if (placeholderInfos.content === this.data.originalText) {
                $placeholder.html(this.data.originalHTML);
            } else if (placeholderInfos.content && placeholderInfos.content.length) {
                $placeholder.text(placeholderInfos.content);
            } else {
                $placeholder.text(placeholderInfos.url);
            }
        }
    },
    /**
     * @abstract
     * @private
     */
    _updateOptionsUI: function () {},

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onAnyChange: function () {
        this._adaptPreview();
    },
});

return Placeholder;
});
