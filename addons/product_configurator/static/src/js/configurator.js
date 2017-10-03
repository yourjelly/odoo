odoo.define('product_configurator.configurator', function (require) {
"use strict";

var AbstractField = require('web.AbstractField');
var core = require('web.core');
var field_registry = require('web.field_registry');
var time = require('web.time');
var Widget = require('web.Widget');

var _t = core._t;
var qweb = core.qweb;


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
        if (!this.configurator && data) {
            this.configurator = new Configurator(this, data);
            this.configurator.prependTo(this.$el);
        } else {
            this.$el.html('');
            return $.when();
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
        "config_field_changed": "_onFieldValueChanged",
    },
    /**
     * @constructor
     * @override init from AbstractField
     */
    init: function(parent, data) {
        this.data = data;
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    start: function() {
        var self = this;
        _.each(this.data, function(field) {
            self._createConfiguratorFieldsWidget(field);
        });
        this._super.apply(this, arguments);
    },

    getData: function () {
        return JSON.stringify(this.data);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onFieldValueChanged: function(field) {
        for (var i = 0; i < this.data.length; i++) {
            if (this.data[i].id === parseInt(field.data.id)) {
                this.data[i].selected_value = this.data[i].type === 'custom' ? field.data.value : parseInt(field.data.value);
                if (this.data[i].value_type === 'binary') {
                    this.data[i].name = field.data.name;
                }
            }
        }
    },
    /**
     * @private
     */
     _createConfiguratorFieldsWidget: function (field) {
        var widget = new ConfiguratorFieldsWidget(this, field);
        return widget.appendTo(this.$(".config_fields"));
    },

});


var ConfiguratorFieldsWidget = Widget.extend({
    template: 'ConfiguratorFieldsWidget',
    events: {
        'change .o_field_input, .o_custom_field_input': '_onInputChange',
        'blur .o_custom_field_date, .o_custom_field_datetime' : '_onDatePickerChange',
        'change .o_custom_field_binary': '_onFileInputChange',
    },
    /**
     * @constructor
     * @override init from AbstractField
     */
    init: function(parent, field) {
        this.field = field;
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    start: function() {
        if (this.field.type == 'custom' && (this.field.value_type === 'datetime' || this.field.value_type === 'date')) {
            this._initDatetimePicker();
        }
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
        var value = {
            id: $input.data('attr-id'),
            value: $input.val(),
        }
        this._setValue(value);
    },

    /**
     * @private
     */
    _onFileInputChange: function(ev) {
        //TODO: check the file Size and other validation
        var self = this;
        var $input = $(ev.target);
        var file = $input.prop('files')[0];
        if (file) {
            var filereader = new FileReader();
            filereader.readAsDataURL(file);
            filereader.onloadend = function (upload) {
                var data = upload.target.result;
                data = data.split(',')[1];
                var value = {
                    id: $input.data('attr-id'),
                    value: data,
                    name: file.name,
                }
                self._setValue(value);
            };
        }
    },

    /**
     * @private
     */
    _onDatePickerChange: function(ev) {
        var $input = $(ev.target);
        var value = {
            id: $input.data('attr-id'),
            value: $input.val(),
        }
        this._setValue(value);
    },

    /**
     * @private
     */
    _setValue: function (value) {
        this.trigger_up('config_field_changed', value);
    },

    /**
     * @private
     */
    _initDatetimePicker: function () {
        var l10n = _t.database.parameters;
        var datepickers_options = {
            minDate: moment({ y: 1900 }),
            maxDate: moment().add(200, "y"),
            calendarWeeks: true,
            icons : {
                time: 'fa fa-clock-o',
                date: 'fa fa-calendar',
                next: 'fa fa-chevron-right',
                previous: 'fa fa-chevron-left',
                up: 'fa fa-chevron-up',
                down: 'fa fa-chevron-down',
               },
            locale : moment.locale(),
            format : time.strftime_to_moment_format(l10n.date_format +' '+ l10n.time_format),
        };
        this.$('.o_custom_field_datetime').datetimepicker(datepickers_options);
        // Adapt options to date-only pickers
        datepickers_options.format = time.strftime_to_moment_format(l10n.date_format);
        this.$('.o_custom_field_date').datetimepicker(datepickers_options);
    },
});


field_registry.add('product_configurator', ProductConfiguratorWidget);

});
