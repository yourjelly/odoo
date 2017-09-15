odoo.define('product_configurator.configurator', function (require) {
"use strict";

var AbstractField = require('web.AbstractField');
var field_registry = require('web.field_registry');
var Widget = require('web.Widget');


var ProductConfiguratorWidget = AbstractField.extend({
    events: _.extend({}, AbstractField.prototype.events),
    supportedFieldTypes: ['char'],

    /**
     * @constructor
     * @override init from AbstractField
     */
    init: function () {
        this._super.apply(this, arguments);
        this._setState();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

     /**
     * @override
     */

    commitChanges: function () {
        if (this.configurator) {
            this._setValue(this.configurator.getData());
        }
        return this._super.apply(this, arguments);
    },

    /**
     * @override
     * @returns {boolean}
     */
    isSet: function() {
        return true;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override _reset from AbstractField
     * @private
     */
    _reset: function () {
        this._super.apply(this, arguments);
        var oldConfigModel = this._configModel;
        this._setState();
        if (this.configurator && this._configModel == oldConfigModel) {
            this.configurator.destroy();
            this.configurator = null;
        }
    },

    /**
     * @private
     * @override
     */
    _render: function() {
        var self = this;
        var data = JSON.parse(this.value);
        if (!data) {
            this.$el.html('');
            return $.when();
        }
        if (!this.configurator) {
            this.configurator = new Configurator(this, data);
            this.configurator.prependTo(this.$el);
        }
    },

    /**
     * @private
     */
    _setState: function () {
        var data = this.recordData['product_tmpl_id'];
        this._configModel = data.model;
    },

});

var Configurator = Widget.extend({
    template: 'Configurator',
    custom_events: {
        "config_field_changed": "_onFieldValueChange",
    },
    /**
     * @constructor
     * @override init from AbstractField
     */
    init: function(parent, data) {
        this.data = data.data;
        this.alldata = data; //TODO: can be replace by proper data structure
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    start: function() {
        var self = this;
        _.each(this.data, function(field) {
            var defaultValue = self.getDefaultValue(field);
            var field_widget = new ConfiguratorFieldsWidget(self, field, defaultValue);
            field_widget.appendTo(self.$('.config_fields'));
        });
        this._super.apply(this, arguments);
    },

    //TODO: Should be remove by sending proper JSON Data
    getDefaultValue: function (field) {
        var res = this.alldata.result;
        for (var i = 0; i < res.length; i++) {
            if (res[i].id === field.id) return res[i].value;
        }
    },

    getData: function () {
        return JSON.stringify(this.alldata);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onFieldValueChange: function(field) {
        for (var i = 0; i < this.alldata.result.length; i++) {
            if (this.alldata.result[i].id === parseInt(field.data.id)) {
                this.alldata.result[i].value = parseInt(field.data.value);
            }
        }
    },

});


var ConfiguratorFieldsWidget = Widget.extend({
    template: 'ConfiguratorFieldsWidget',
    events: {
        'change input': '_onInputChange',
        'change select': '_onSelectionChange',
    },
    /**
     * @constructor
     * @override init from AbstractField
     */
    init: function(parent, field, defaultValue) {
        this.field = field;
        this.defaultValue = defaultValue;
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    start: function() {
        this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onInputChange: function(ev) {
        var $input = $(ev.target);
        var vals = {
            id: $input.attr('name'),
            value: $input.val(),
        }
        this.trigger_up('config_field_changed', vals);
    },

    /**
     * @private
     */
    _onSelectionChange: function(ev) {
        var $select = $(ev.target);
        var vals = {
            id: $select.attr('name'),
            value: $select.val(),
        }
        this.trigger_up('config_field_changed', vals);
    }
});


field_registry.add('product_configurator', ProductConfiguratorWidget);

});
