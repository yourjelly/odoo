odoo.define('uom.UomFieldWidget', function (require) {
"use strict";

var core = require('web.core');
var basic_fields = require('web.basic_fields');
var field_registry = require('web.field_registry');
var fieldUtils = require('web.field_utils');

var _t = core._t;

var FieldFloat = basic_fields.FieldFloat;
var DebouncedField = basic_fields.DebouncedField

var FieldUom = FieldFloat.extend({
    events: _.extend({}, DebouncedField.prototype.events, {
        'input': '_onInput',
    }),

    willStart: function () {
        return $.when(this._setUom(), this._super.apply(this, arguments));
    },
    
    _setUom: function () {
        var self = this;
        var uomField = this.nodeOptions.uom_field;
        var uomID = this.record.data[uomField] && this.record.data[uomField].res_id;
        if (!uomID) {
            return $.when().then(function () {
                self.formatOptions.uom = {
                    'rounding': 0.01,
                    'decimal_places' : 2
                };
            });
        } else {
            return this._rpc({
                model: 'uom.uom',
                method: 'read',
                args: [[uomID]],
            }).then(function (result) {
                self.formatOptions.uom = result[0];
            });
        }
    },

    _onInput: function() {
        this._super.apply(this, arguments);
        // var rounding = this.formatOptions.uom.rounding;
        // var rounding_per = 0;
        var value = this.$input.val();
        var uom_precision = this.formatOptions.uom.decimal_places;
        // if (Math.floor(rounding) != rounding) {
        //     rounding_per = rounding.toString().split('.')[1].length;
        // }
        if (value.includes('.')) {
            // value = value.split(' ');
            var precision = value.split('.')[1].length;
            if (uom_precision < precision) {
                this.do_warn(_.str.sprintf(_t('Only %s decimal digits are allow.'), uom_precision));
                this.$input.val(value.slice(0,-1))
            }
        }
    },

});

field_registry
    .add('uom', FieldUom);

fieldUtils.format.uom = function(value, field, options) {
    options = options || {};
    if (value === false) {
        return "";
    }
    // var rounding = options.uom.rounding || 0.01;
    // // var units = options.uom.name;
    // var precision = 0;
    // if (Math.floor(rounding) != rounding) {
    //     precision = rounding.toString().split('.')[1].length;
    // }
    var precision = options.uom && options.uom.decimal_places;
    return parseFloat(value).toFixed(precision);
};

fieldUtils.parse.uom = function(value) {
    // var value = value.split(' ');
    // if (value.length === 2) {
    //     value = value[0];
    // }
    return fieldUtils.parse.float(value);
};

return {
    FieldUom: FieldUom,
};

});
