odoo.define('hr_attendance.widget', function (require) {
    "use strict";

    const basic_fields = require('web.basic_fields_owl');
    const field_registry = require('web.field_registry_owl');
    const { Component } = owl;

    class RelativeTime extends basic_fields.FieldDateTime{
        _formatValue(val) {
            if (!(val && val._isAMomentObject)) {
                return;
            }
            return val.fromNow(true);
        }
    }
    field_registry.add('relative_time', RelativeTime);
    return RelativeTime;
});