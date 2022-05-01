odoo.define('wysiwyg.widgets.PlaceholderDialog', function (require) {
'use strict';

const Dialog = require('wysiwyg.widgets.Dialog');
const Placeholder = require('wysiwyg.widgets.Placeholder');


// This widget is there only to extend Placeholder and be instantiated by PlaceholderDialog.
const _DialogPlaceholderWidget = Placeholder.extend({
    template: 'wysiwyg.widgets.placeholder',
    events: _.extend({}, Placeholder.prototype.events || {}, {
        'change [name="placeholder_style_color"]': '_onTypeChange',
    }),

    /**
     * @override
     */
    start: function () {
        this.buttonOptsCollapseEl = this.el.querySelector('#o_placeholder_dialog_button_opts_collapse');
        this.$styleInputs = this.$('input.placeholder-style');
        this.$styleInputs.prop('checked', false).filter('[value=""]').prop('checked', true);
        if (this.data.isNewWindow) {
            this.$('we-button.o_we_checkbox_wrapper').toggleClass('active', true);
        }
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    save: function () {
        var data = this._getData();
        if (data === null) {
            var $value = this.$('input[name="value"]');
            $value.closest('.form-group').addClass('o_has_error').find('.form-control, .custom-select').addClass('is-invalid');
            $value.focus();
            return Promise.reject();
        }
        this.data.condition = data.condition;
        this.data.value = data.value;
        this.final_data = this.data;
        return Promise.resolve();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _adaptPreview: function () {
        var data = this._getData();
        if (data === null) {
            return;
        }
        // TODO PMO: adapt preview
        /*const attrs = {
            target: '_blank',
            href: data.url && data.url.length ? data.url : '#',
            class: `${data.classes.replace(/float-\w+/, '')} o_btn_preview`,
        };

        const $placeholderPreview = this.$("#placeholder-preview");
        $placeholderPreview.attr(attrs);
        this._updatePlaceholderContent($placeholderPreview, data, { force: true });*/
    },
    /**
     * @override
     */
    _doStripDomain: function () {
        return this.$('#o_placeholder_dialog_url_strip_domain').prop('checked');
    },
    /**
     * @override
     */
    _getPlaceholderOptions: function () {
        const options = [
            'input[name="placeholder_style_color"]',
            'select[name="placeholder_style_size"] > option',
            'select[name="placeholder_style_shape"] > option',
        ];
        return this.$(options.join(','));
    },
    /**
     * @override
     */
    _getPlaceholderShape: function () {
        return this.$('select[name="placeholder_style_shape"]').val() || '';
    },
    /**
     * @override
     */
    _getPlaceholderSize: function () {
        return this.$('select[name="placeholder_style_size"]').val() || '';
    },
    /**
     * @override
     */
    _getPlaceholderType: function () {
        return this.$('input[name="placeholder_style_color"]:checked').val() || '';
    },
    /**
     * @private
     */
    _isFromAnotherHostName: function (url) {
        if (url.includes(window.location.hostname)) {
            return false;
        }
        try {
            const Url = URL || window.URL || window.webkitURL;
            const urlObj = url.startsWith('/') ? new Url(url, window.location.origin) : new Url(url);
            return (urlObj.origin !== window.location.origin);
        } catch (ignored) {
            return true;
        }
    },
    /**
     * @override
     */
    _isNewWindow: function (url) {
        if (this.options.forceNewWindow) {
            return this._isFromAnotherHostName(url);
        } else {
            return this.$('input[name="is_new_window"]').prop('checked');
        }
    },
    /**
     * @override
     */
    _setSelectOption: function ($option, active) {
        if ($option.is("input")) {
            $option.prop("checked", active);
        } else if (active) {
            $option.parent().find('option').removeAttr('selected').removeProp('selected');
            $option.parent().val($option.val());
            $option.attr('selected', 'selected').prop('selected', 'selected');
        }
    },
    /**
     * @override
     */
    _updateOptionsUI: function () {
        const el = this.el.querySelector('[name="placeholder_style_color"]:checked');
        $(this.buttonOptsCollapseEl).collapse(el && el.value ? 'show' : 'hide');
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onTypeChange() {
        this._updateOptionsUI();
    },
    /**
     * @override
     */
    _onURLInput: function () {
        this._super(...arguments);
        this.$('#o_placeholder_dialog_url_input').closest('.form-group').removeClass('o_has_error').find('.form-control, .custom-select').removeClass('is-invalid');
    },
});

/**
 * Allows to customize placeholder content and style.
 */
const PlaceholderDialog = Dialog.extend({
    init: function (parent, ...args) {
        this._super(...arguments);
        this.placeholderWidget = new _DialogPlaceholderWidget(this, ...args);
    },
    start: async function () {
        const res = await this._super(...arguments);
        await this.placeholderWidget.appendTo(this.$el);
        return res;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    save: function () {
        const _super = this._super.bind(this);
        const saveArguments = arguments;
        return this.placeholderWidget.save().then(() => {
            this.final_data = this.placeholderWidget.final_data;
            return _super(...saveArguments);
        });
    },
});

return PlaceholderDialog;
});
