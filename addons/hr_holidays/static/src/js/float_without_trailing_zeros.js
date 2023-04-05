/** @odoo-module **/
import { fieldRegistry } from "@web/legacy/js/fields/field_registry";
import * as basic_fields from "@web/legacy/js/fields/basic_fields";

var FieldFloat = basic_fields.FieldFloat;

var FloatWithoutTrailingZeros = FieldFloat.extend({
    _renderReadonly: function () {
        var value = this._formatValue(this.value);
        var parsed_value = parseFloat(value);
        value = parsed_value.toString().replace(/\.0+$/, '');
        this.$el.text(value);
    }
});

fieldRegistry.add('float_without_trailing_zeros', FloatWithoutTrailingZeros);

