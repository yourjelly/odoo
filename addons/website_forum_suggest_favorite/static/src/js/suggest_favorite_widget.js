odoo.define('website_forum_suggest_favorite.suggest_favorite_widget', function (require) {
"use strict";

var Dialog = require('web.Dialog');

var _t = core._t;

//------------------------------------------------------------------------------
// Many2one widgets
//------------------------------------------------------------------------------

var M2ODialog = Dialog.extend({
    template: "M2ODialog",
    init: function (parent, name, value) {
        this.name = name;
        this.value = value;
        this._super(parent, {
            title: _.str.sprintf(_t("Create a %s"), this.name),
            size: 'medium',
            buttons: [{
                text: _t('Create'),
                classes: 'btn-primary',
                click: function () {
                    if (this.$("input").val() !== ''){
                        this.trigger_up('quick_create', { value: this.$('input').val() });
                        this.close(true);
                    } else {
                        this.$("input").focus();
                    }
                },
            }, {
                text: _t('Create and edit'),
                classes: 'btn-primary',
                close: true,
                click: function () {
                    this.trigger_up('search_create_popup', {
                        view_type: 'form',
                        value: this.$('input').val(),
                    });
                },
            }, {
                text: _t('Cancel'),
                close: true,
            }],
        });
    },
    start: function () {
        this.$("p").text(_.str.sprintf(_t("You are creating a new %s, are you sure it does not exist yet?"), this.name));
        this.$("input").val(this.value);
    },
    /**
     * @override
     * @param {boolean} isSet
     */
    close: function (isSet) {
        this.isSet = isSet;
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    destroy: function () {
        if (!this.isSet) {
            this.trigger_up('closed_unset');
        }
        this._super.apply(this, arguments);
    },
});