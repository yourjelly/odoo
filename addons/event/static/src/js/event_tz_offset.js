odoo.define('event.EventTzOffset', function(require) {
"use strict";

var fieldRegistry = require('web.field_registry');
var basic_fields = require('web.basic_fields');
var time = require('web.time');
var utils = require('web.utils');
var FieldDateTime = basic_fields.FieldDateTime;

var EventTzOffset = FieldDateTime.extend({
    resetOnAnyFieldChange: true,

    init: function(parent, options){
        this._super.apply(this, arguments);
        this.nodeOptions.tz_offset_field = this.record.data.tz_offset;
        this.diff = moment().utcOffset(this.nodeOptions.tz_offset_field).utcOffset();
    },

    reset: function(record, event) {
        this.nodeOptions.tz_offset_field = record.data.tz_offset;
        this.diff = moment().utcOffset(this.nodeOptions.tz_offset_field).utcOffset();
        var value = this._getValue();
        this._setValue(value, {notifyChange: false});
        return this._super.apply(this, arguments);
    },

    _parseValue: function(value) {
        if (!value) {
            return false;
        }
        var datetime;
            datetime = moment.utc(value).local();
            datetime.add(-this.diff, 'minutes');
        if (datetime.isValid()) {
            if (datetime.year() === 0) {
                datetime.year(moment.utc().year());
            }
            if (datetime.year() >= 1900) {
                datetime.toJSON = function () {
                    return this.clone().locale('en').format('YYYY-MM-DD HH:mm:ss');
                };
                return datetime;
            }
        }
        throw new Error(_.str.sprintf(core._t("'%s' is not a correct datetime"), value));
    },

    _formatValue: function(value) {
        if (value === false) {
            return "";
        } else {
            value = value.clone().add(this.diff, 'minutes');
        }
        return value.format(time.getLangDatetimeFormat());
    },

    _renderEdit: function () {
        var value = this.value && this.value.clone().add(this.diff, 'minutes');
        this.datewidget.setValue(value);
        this.$input = this.datewidget.$input;
    },

});


fieldRegistry.add('event_tz_offset', EventTzOffset);

return EventTzOffset;

});