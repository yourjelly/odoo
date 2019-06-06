(function () {
'use strict';

var CodeViewPlugin = class extends we3.AbstractPlugin {
    /**
     * @override
     */
    constructor (parent, params) {
        super(...arguments);

        this.templatesDependencies = ['/web_editor/static/src/xml/wysiwyg_codeview.xml'];
        this.buttons = {
            template: 'wysiwyg.buttons.codeview',
            active: '_isActive',
            enabled: '_enabled',
        };

        this.getValueOptions = {
            keepVirtual: true,
            architecturalSpace: true,
        };
        this.codeview = this._createCodable();
        params.insertAfterContainer(this.codeview);
    }
    /**
     * @override
     */
    start () {
        this._deactivate();
        return super.start();
    }
    /**
     * @override
     */
    destroy () {
        this.isBeingDestroyed = true;
        super.destroy();
    }
    focusEditor () {
        if (this._isActive()) {
            this._resize();
        }
    }
    /**
     * @overwrite
     */
    getEditorValue (value) {
        if (this._isActive()) {
            return this.codeview.value.trim();
        }
        return value;
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    active (value, options) {
        var self = this;
        if (!this._isActive()) {
            if (value) {
                this._setCodeViewValue(value);
            } else {
                this.triggerUp('get_value', {
                    options: options,
                    callback (value) {
                        self._setCodeViewValue(value);
                    },
                });
            }
            this._activate();
        }
    }
    deactivate (value) {
        if (this._isActive()) {
            this._deactivate();
            this.triggerUp('set_value', {
                value: value || this.codeview.value.trim(),
            });
        }
    }
    /**
     * Toggle the code view
     */
    toggle () {
        if (this._isActive()) {
            this.deactivate();
        } else {
            this.active(null, this.getValueOptions);
        }
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Activate the code view and deactivate the wysiwyg view
     */
    _activate () {
        this.isActive = true;
        this.codeview.style.display = '';
        this.editable.style.display = 'none';
        this._resize();
        this._focus();
        this.trigger('active');
    }
    /**
     * create the codable view
     */
    _createCodable () {
        var codeview = document.createElement('textarea');
        codeview.name = 'codeview';
        codeview.oninput = this._resize.bind(this);
        codeview.style.display = 'none';
        return codeview;
    }
    /**
     * Return true if the codeview is active
     *
     * @returns {Boolean}
     */
    _isActive () {
        return this.isActive;
    }
    /**
     * Blur the code view and focus the wysiwyg view
     */
    _blur() {
        this.codeview.blur();
        this.editable.focus();
    }
    /**
     * Deactivate the code view and activate the wysiwyg view
     */
    _deactivate () {
        this.isActive = false;
        this.codeview.style.display = 'none';
        this.editable.style.display = '';
        this._blur();
        this.trigger('deactivate');
    }
    /**
     * Return true if the codeview is active
     *
     * @returns {Boolean}
     */
    _enabled () {
        return true;
    }
    /**
     * Focus the code view and blur the wysiwyg view
     */
    _focus () {
        this.editable.blur();
        this.codeview.focus();
    }
    /**
     * Resize the code view textarea to fit its contents
     */
    _resize () {
        this.codeview.style.height = '';
        this.codeview.style.height = this.codeview.scrollHeight + "px";
    }
    /**
     * Set the value of the code view
     *
     * @param {String} value
     */
    _setCodeViewValue (value) {
        this.codeview.value = value.trim();
    }
};

we3.addPlugin('CodeView', CodeViewPlugin);

})();
