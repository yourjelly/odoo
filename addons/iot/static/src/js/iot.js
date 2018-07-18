odoo.define('iot.floatinput', function (require) {
"use strict";

var core = require('web.core');
var Widget = require('web.Widget');
var registry = require('web.field_registry');

var FieldFloat = require('web.basic_fields').InputField

var IotFieldFloat = FieldFloat.extend({
    className: 'o_field_iot o_field_float o_field_number',  //or do some extends
    tagName: 'span',

    events: _.extend(FieldFloat.prototype.events, {
        'click .o_button_iot': '_onButtonClick',
    }),


    init: function () {
        this._super.apply(this, arguments);
        if (this.mode === 'edit') {
            this.tagName = 'div';
            this.className += ' o_input';
        }
    },

    _renderEdit: function() {
        this.$el.empty();

        // Prepare and add the input
        this._prepareInput(this.$input).appendTo(this.$el);

        var $button = $('<button>', {class: 'o_button_iot', string: 'IoT'});
        $button.appendTo(this.$el);
    },


    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    _onButtonClick: function (ev) {
        var self = this;
        $.get("http://10.30.13.104:8069/driverdetails/0403:6001", function(data){
            self._setValue(data);
            self._render();
        });
        //this._rpc()
        //})
        //self = this;
        //$.ajax().then(function(result) {
        //    self.$input.value =
    }

})

registry.add('iot', IotFieldFloat);
});
