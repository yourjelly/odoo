odoo.define('web_editor.wysiwyg.block_option.background_position', function (require) {
'use strict';

var ajax = require('web.ajax');
var core = require('web.core');
var Dialog = require('web.Dialog');

var qweb = core.qweb;
var _t = core._t;


var BackgroundPositionOption = class extends (we3.getPlugin('BlockOption:default')) {

    /**
     * @override
     */
    onFocus(ui, target, state) {
        this.onForeignOptionChange(ui, target);
    }
    /**
     * @override
     */
    onForeignOptionChange(ui, target) {
        var bgImage = target.style.backgroundImage;
        this._toggleUI(ui, bgImage && bgImage !== 'none'); // FIXME computed style ?
    }

    //--------------------------------------------------------------------------
    // Options
    //--------------------------------------------------------------------------

    /**
     * Opens a Dialog to edit the snippet's backgroung image position.
     *
     * @see this.selectClass for parameters
     */
    backgroundPosition(target, state, previewMode, value, ui, opt) {
        var self = this;

        var loadTemplatePromise = ajax.loadXML('/web_editor/static/src/xml/editor.xml', qweb);

        state.prevDesign = [target.className, target.style.backgroundSize, target.style.backgroundPosition];

        state.bgPos = target.style.backgroundPosition.split(' ');
        state.bgSize = target.style.backgroundSize.split(' ');

        loadTemplatePromise.then(function () {
            self.modal = new Dialog(null, { // FIXME parent
                title: _t("Background Image Sizing"),
                $content: $(qweb.render('web_editor.dialog.background_position')),
                buttons: [
                    {text: _t("Ok"), classes: 'btn-primary', close: true, click: function () {
                        self._saveChanges(target, state, previewMode);
                    }},
                    {text: _t("Discard"), close: true, click: function () {
                        self._discardChanges(target, previewMode);
                    }},
                ],
            }).open();

            self.modal.opened().then(function () {
                // Fetch data from target
                var value = (target.classList.contains('o_bg_img_opt_contain') ? 'contain' : (target.classList.contains('o_bg_img_opt_custom') ? 'custom' : 'cover'));
                var inputs = self.modal.el.querySelectorAll('label > input[value="' + value + '"]');
                inputs.forEach(function (input) {
                    input.checked = true;
                });

                if (target.classList.contains('o_bg_img_opt_repeat')) {
                    self.modal.el.querySelector('#o_bg_img_opt_contain_repeat').checked = true;
                    self.modal.el.querySelector('#o_bg_img_opt_custom_repeat').value = 'o_bg_img_opt_repeat';
                } else if (target.classList.contains('o_bg_img_opt_repeat_x')) {
                    self.modal.el.querySelector('#o_bg_img_opt_custom_repeat').value = 'o_bg_img_opt_repeat_x';
                } else if (target.classList.contains('o_bg_img_opt_repeat_y')) {
                    self.modal.el.querySelector('#o_bg_img_opt_custom_repeat').value = 'o_bg_img_opt_repeat_y';
                }

                if (state.bgPos.length > 1) {
                    state.bgPos = {
                        x: state.bgPos[0],
                        y: state.bgPos[1],
                    };
                    self.modal.el.querySelector('#o_bg_img_opt_custom_pos_x').value = state.bgPos.x.replace('%', '');
                    self.modal.el.querySelector('#o_bg_img_opt_custom_pos_y').value = state.bgPos.y.replace('%', '');
                }
                if (state.bgSize.length > 1) {
                    self.modal.el.querySelector('#o_bg_img_opt_custom_size_x').value = state.bgSize[0].replace('%', '');
                    self.modal.el.querySelector('#o_bg_img_opt_custom_size_y').value = state.bgSize[1].replace('%', '');
                }

                // Focus Point
                self.focusElement = self.modal.el.querySelector('.o_focus_point');
                self._updatePosInformation(state);

                var imgURL = /\(['"]?([^'"]+)['"]?\)/g.exec(target.style.backgroundImage); // FIXME computed style ?
                imgURL = (imgURL && imgURL[1]) || '';
                var image = document.createElement('img');
                image.classList.add('img', 'img-fluid');
                image.src = imgURL;
                image.addEventListener('load', function () {
                    self._bindImageEvents(image, target, state);
                });
                var el = self.modal.el.querySelector('.o_bg_img_opt_object');
                el.insertBefore(image, el.firstChild);

                // Bind events
                var allInputs = self.modal.el.querySelectorAll('input[name="o_bg_img_opt"]');
                allInputs.forEach(function (input) {
                    input.addEventListener('change', function (ev) {
                        _adapOptsToValue(ev.target.value);
                    });
                });
                var allInputsAndSelects = self.modal.el.querySelectorAll('input, select');
                allInputsAndSelects.forEach(function (input) {
                    input.addEventListener('change', function () {
                        self._saveChanges(target, state, previewMode);
                    });
                });

                var checkedInputs = self.modal.el.querySelectorAll('input[name="o_bg_img_opt"]:checked');
                checkedInputs.forEach(function (input) {
                    _adapOptsToValue(input.value);
                });
                if (checkedInputs.length) {
                    self._saveChanges(target, state, previewMode);
                }

                function _adapOptsToValue(value) {
                    self.modal.el.querySelectorAll('.o_bg_img_opt').forEach(function (el) {
                        el.classList.toggle('o_hidden', el.dataset.value !== value);
                    });
                }
            });
        });
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Bind events on the given image so that the users can adapt the focus
     * point.
     *
     * @private
     * @param {HTMLElement} img
     */
    _bindImageEvents(img, target, state) {
        var self = this;

        var mousedown = false;
        img.addEventListener('mousedown', function (ev) {
            mousedown = true;
        });
        img.addEventListener('mousemove', function (ev) {
            if (mousedown) {
                _update(ev);
            }
        });
        img.addEventListener('mouseup', function (ev) {
            self.focusElement.classList.add('o_with_transition');
            _update(ev);
            setTimeout(function () {
                self.focusElement.classList.remove('o_with_transition');
            }, 200);
            mousedown = false;
        });

        function _update(ev) {
            var rect = img.getBoundingClientRect();
            var posX = ev.pageX - rect.x;
            var posY = ev.pageY - rect.y;
            state.bgPos = {
                x: clipValue(posX / img.offsetWidth * 100).toFixed(2) + '%',
                y: clipValue(posY / img.offsetHeight * 100).toFixed(2) + '%',
            };
            self._updatePosInformation(state);
            self._saveChanges(target, state, true);

            function clipValue(value) {
                return Math.max(0, Math.min(value, 100));
            }
        }
    }
    /**
     * Removes all option-related classes and style on the target element.
     *
     * @private
     */
    _clean(target, previewMode) {
        this._removeClass(target, previewMode, 'o_bg_img_opt_contain o_bg_img_opt_custom o_bg_img_opt_repeat o_bg_img_opt_repeat_x o_bg_img_opt_repeat_y');
        this._removeStyle(target, previewMode, ['background-size', 'background-position']);
    }
    /**
     * Restores the target style before last edition made with the option.
     *
     * @private
     */
    _discardChanges(target, previewMode) {
        this._clean(target, previewMode);
        if (this.prevDesign) {
            this._addClass(target, previewMode, this.prevDesign[0]);
            this._applyStyle(target, previewMode, {
                backgroundSize: this.prevDesign[1],
                backgroundPosition: this.prevDesign[2],
            });
        }
    }
    /**
     * Updates the target element to match the chosen options.
     *
     * @private
     */
    _saveChanges(target, state, previewMode) {
        this._clean(target, previewMode);

        var bgImgSize = this.modal.el.querySelector('.o_bg_img_opt:not(.o_hidden)').dataset.value || 'cover';
        switch (bgImgSize) {
            case 'cover':
                this._applyStyle(target, previewMode, {
                    backgroundPosition: state.bgPos.x + ' ' + state.bgPos.y,
                });
                break;
            case 'contain':
                this._addClass(target, previewMode, 'o_bg_img_opt_contain');
                this._toggleClass(target, previewMode, 'o_bg_img_opt_repeat', this.modal.el.querySelector('#o_bg_img_opt_contain_repeat').checked);
                break;
            case 'custom':
                this._addClass(target, previewMode, 'o_bg_img_opt_custom');

                var sizeX = this.modal.el.querySelector('#o_bg_img_opt_custom_size_x').value;
                var sizeY = this.modal.el.querySelector('#o_bg_img_opt_custom_size_y').value;
                var posX = this.modal.el.querySelector('#o_bg_img_opt_custom_pos_x').value;
                var posY = this.modal.el.querySelector('#o_bg_img_opt_custom_pos_y').value;
                var className = this.modal.el.querySelector('#o_bg_img_opt_custom_repeat').value;
                if (className) {
                    this._addClass(target, previewMode, className);
                }
                this._applyStyle(target, previewMode, {
                    backgroundSize: (sizeX ? sizeX + '%' : 'auto') + ' ' + (sizeY ? sizeY + '%' : 'auto'),
                    backgroundPosition: (posX ? posX + '%' : 'auto') + ' ' + (posY ? posY + '%' : 'auto'),
                });
                break;
        }
    }
    /**
     * Updates the visual representation of the chosen background position.
     *
     * @private
     * @param {object} state
     */
    _updatePosInformation(state) {
        this.modal.el.querySelector('.o_bg_img_opt_ui_info .o_x').textContent = state.bgPos.x;
        this.modal.el.querySelector('.o_bg_img_opt_ui_info .o_y').textContent = state.bgPos.y;
        this.focusElement.style.left = state.bgPos.x;
        this.focusElement.style.top = state.bgPos.y;
    }
};

we3.getPlugin('CustomizeBlock').registerOptionPlugIn('background_position', BackgroundPositionOption);
});
