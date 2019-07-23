odoo.define('web_editor.wysiwyg.block_option.background', function (require) {
'use strict';

// var MediaDialog = require('wysiwyg.widgets.MediaDialog');

var BackgroundOption = class extends (we3.getPlugin('BlockOption:default')) {

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Handles a background change.
     *
     * @see this.selectClass for parameters
     */
    background(target, state, previewMode, value, ui, opt) {
        if (previewMode === 'reset' && value === undefined) {
            // No background has been selected and we want to reset back to the
            // original custom image
            this._setCustomBackground(ui, target, state, state.__customImageSrc);
            return;
        }

        if (value && value.length) {
            this._applyStyle(target, previewMode, {
                backgroundImage: 'url(\'' + value + '\')',
            });
            this._removeClass(target, previewMode, 'oe_custom_bg');
            this._addClass(target, previewMode, 'oe_img_bg');
        } else {
            this._removeStyle(target, previewMode, ['background-image']);
            this._removeClass(target, previewMode, 'oe_img_bg oe_custom_bg');
        }
    }
    /**
     * Opens a media dialog to add a custom background image.
     *
     * @see this.selectClass for parameters
     */
    chooseImage(target, state, previewMode, value, ui, opt) {
        // Put fake image in the DOM, edit it and use it as background-image
        // var image = document.createElement('img');
        // image.classList.add('d-none');
        // image.setAttribute('src', value === 'true' ? '' : value);
        // target.appendChild(image);

        // FIXME
        // var $editable = this.$target.closest('.o_editable');
        // var resModel = $editable.data('oe-model');
        // var resID = $editable.data('oe-id');

        // var _editor = new MediaDialog(WysiwygRoot.prototype.getInstance(), { // FIXME parent ?
        //     onlyImages: true,
        //     mediaWidth: 1920,
        //     firstFilters: ['background'],
        //     res_model: undefined, // FIXME
        //     res_id: undefined, // FIXME
        // }, image).open();

        // _editor.on('save', this, function (image) {
            this._setCustomBackground(ui, target, state, 'https://www.odoo.com/logo.png'); // image.src);
            // this.$target.trigger('content_changed'); FIXME
        // });
        // _editor.on('closed', this, function () {
        //     if (image.parentNode) {
        //         image.parentNode.removeChild(image);
        //     }
        // });
    }
    /**
     * @override
     */
    selectClass(target, state, previewMode, value, ui, opt) {
        this.background(target, state, previewMode, '', ui, opt);
        super.selectClass(target, state, previewMode, value ? (value + ' oe_img_bg') : value, opt);
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Returns the src value from a css value related to a background image
     * (e.g. "url('blabla')" => "blabla" / "none" => "").
     *
     * @private
     * @param {DOMElement} target
     * @param {string} value
     * @returns {string}
     */
    _getSrcFromCssValue(target, value) {
        if (value === undefined) {
            value = target.style.backgroundImage; // FIXME computed style ?
        }
        var srcValueWrapper = /url\(['"]*|['"]*\)|^none$/g;
        return value && value.replace(srcValueWrapper, '') || '';
    }
    /**
     * @override
     */
    _setActive(ui, target) {
        super._setActive(...arguments);

        var src = this._getSrcFromCssValue(target);
        ui.querySelectorAll('[data-background]').forEach(function (el) {
            var bg = el.dataset.background;
            el.classList.toggle('active', (bg === '' && src === '' || bg !== '' && src.indexOf(bg) >= 0));
        });
        ui.querySelectorAll('[data-choose-image]').forEach(function (el) {
            el.classList.toggle('active', target.classList.contains('oe_custom_bg'));
        });
    }
    /**
     * Sets the given value as custom background image.
     *
     * @private
     */
    _setCustomBackground(ui, target, state, value) {
        state.__customImageSrc = value;
        this.background(target, state, false, state.__customImageSrc, ui);
        this._addClass(target, false, 'oe_custom_bg');
        this._setActive(ui, target);
        // this.$target.trigger('snippet-option-change', [this]); FIXME
    }
};

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('background', BackgroundOption);
});
