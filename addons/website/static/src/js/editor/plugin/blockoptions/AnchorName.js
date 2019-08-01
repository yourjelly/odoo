odoo.define('web_editor.wysiwyg.block_option.AnchorName', function (require) {
'use strict';

var ajax = require('web.ajax');
var core = require('web.core');
var Dialog = require('web.Dialog');

var _t = core._t;
var qweb = core.qweb;

var BlockOption = we3.getPlugin('BlockOption:default');
var BlockOptionHandler = BlockOption.Handler;

var AnchorNameOptionHandler = class extends BlockOptionHandler {
    /**
     * @override
     */
    onClone(target, options) {
        this._removeAttr(target, false, 'id');
        this._removeDataAttr(target, false, 'anchor');
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * @see this.selectClass for parameters
     */
    openAnchorDialog(target, state, previewMode, value, ui, opt) {
        var self = this;
        var loadTemplatePromise = ajax.loadXML('/website/static/src/xml/website.editor.xml', qweb);
        var buttons = [{
            text: _t("Save"),
            classes: 'btn-primary',
            click: function () {
                var $input = this.$('.o_input_anchor_name');
                var anchorName = $input.val().trim().replace(/\s/g, '_');
                var isValid = /^[\w-]+$/.test(anchorName);
                var alreadyExists = isValid && $('#' + anchorName).length > 0;
                var anchorOK = isValid && !alreadyExists;
                this.$('.o_anchor_not_valid').toggleClass('d-none', isValid);
                this.$('.o_anchor_already_exists').toggleClass('d-none', !alreadyExists);
                $input.toggleClass('is-invalid', !anchorOK);
                if (anchorOK) {
                    self._setAnchorName(target, previewMode, anchorName);
                    this.close();
                }
            },
        }, {
            text: _t("Discard"),
            close: true,
        }];
        if (target.id) {
            buttons.push({
                text: _t("Remove"),
                classes: 'btn-link ml-auto',
                icon: 'fa-trash',
                close: true,
                click: function () {
                    self._setAnchorName(target, previewMode);
                },
            });
        }
        loadTemplatePromise.then(function () {
            new Dialog(this, {
                title: _t("Anchor Name"),
                $content: $(qweb.render('website.dialog.anchorName', {
                    currentAnchor: target.id,
                })),
                buttons: buttons,
            }).open();
        });
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {DOMElement} target
     * @param {boolean} previewMode
     * @param {String} value
     */
    _setAnchorName(target, previewMode, value) {
        if (value) {
            this._setAttr(target, previewMode, 'id', value);
            this._setDataAttr(target, previewMode, 'anchor', true);
        } else {
            this._removeAttr(target, previewMode, 'id');
            this._removeDataAttr(target, previewMode, 'anchor');
        }
        // this.$target.trigger('content_changed'); FIXME
    }
};
var AnchorNameOption = class extends BlockOption {
    static Handler = AnchorNameOptionHandler
};

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('anchorName', AnchorNameOption);
});
