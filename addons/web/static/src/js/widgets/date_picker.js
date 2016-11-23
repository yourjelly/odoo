odoo.define('web.datepicker', function (require) {
"use strict";

var ajax = require('web.ajax');
var core = require('web.core');
var formats = require('web.formats');
var time = require('web.time');
var Widget = require('web.Widget');

var _t = core._t;

var DateWidget = Widget.extend({
    template: "web.datepicker",
    type_of_date: "date",
    events: {
        'dp.change': 'change_datetime',
        'dp.show': 'set_datetime_default',
        'change .o_datepicker_input': 'change_datetime',
    },
    init: function(parent, options) {
        this._super.apply(this, arguments);

        var l10n = _t.database.parameters;

        this.name = parent.name;
        this.options = _.defaults(options || {}, {
            format : time.strftime_to_moment_format((this.type_of_date === 'datetime')? (l10n.date_format + ' ' + l10n.time_format) : l10n.date_format),
            minDate: moment({ y: 1900 }),
            maxDate: moment().add(200, "y"),
            calendarWeeks: true,
            icons: {
                time: 'fa fa-clock-o',
                date: 'fa fa-calendar',
                next: 'fa fa-chevron-right',
                previous: 'fa fa-chevron-left',
                up: 'fa fa-chevron-up',
                down: 'fa fa-chevron-down',
            },
            locale : moment.locale(),
            allowInputToggle: true,
            keyBinds: null,
        });
    },
    start: function() {
        var self = this;
        this.$input = this.$('input.o_datepicker_input');
        this.$input.focus(function(e) {
            e.stopImmediatePropagation();
        });
        this.set_readonly(false);
        this.set_value(false);
        this.library_loaded = ajax.loadJS("/web/static/lib/bootstrap-datetimepicker/src/js/bootstrap-datetimepicker.js");
        this.library_loaded.then(function () {
            self.$el.datetimepicker(self.options);
            self.picker = self.$el.data('DateTimePicker');
            self.$input.click(self.picker.toggle.bind(self.picker));
        });
    },
    set_value: function(value) {
        this.set({'value': value});
        this.$input.val((value)? this.format_client(value) : '');
        if (this.picker) {
            this.picker.date(this.format_client(value));
        }
    },
    get_value: function() {
        return this.get('value');
    },
    set_value_from_ui: function() {
        var value = this.$input.val() || false;
        this.set_value(this.parse_client(value));
    },
    set_readonly: function(readonly) {
        this.readonly = readonly;
        this.$input.prop('readonly', this.readonly);
    },
    is_valid: function() {
        var value = this.$input.val();
        if(value === "") {
            return true;
        } else {
            try {
                this.parse_client(value);
                return true;
            } catch(e) {
                return false;
            }
        }
    },
    parse_client: function(v) {
        return formats.parse_value(v, {"widget": this.type_of_date});
    },
    format_client: function(v) {
        return formats.format_value(v, {"widget": this.type_of_date});
    },
    set_datetime_default: function() {
        //when opening datetimepicker the date and time by default should be the one from
        //the input field if any or the current day otherwise
        var value = moment().second(0);
        if(this.$input.val().length !== 0 && this.is_valid()) {
            value = this.$input.val();
        }

        this.picker.date(value);
    },
    change_datetime: function(e) {
        if(this.is_valid()) {
            this.set_value_from_ui();
            this.trigger("datetime_changed");
        }
        //Close the datetimepicker when a date is selected
        //We check only if the date has changed.
        if(!e.date.isSame(e.oldDate, 'day') && this.picker){
            this.picker.hide();
        }
    },
    commit_value: function() {
        this.change_datetime();
    },
    destroy: function() {
        this.picker.destroy();
        this._super.apply(this, arguments);
    },
});

var DateTimeWidget = DateWidget.extend({
    type_of_date: "datetime"
});

return {
    DateWidget: DateWidget,
    DateTimeWidget: DateTimeWidget,
};

});
