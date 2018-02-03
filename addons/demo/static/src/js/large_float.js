odoo.define('demo.LargeFloat', function (require) {
"use strict";

// we import here the field widget that we want to subclass.  For this demo, we
// just want do add some behaviour to FieldFloat, so it makes sense to start
// from there.
var FieldFloat = require('web.basic_fields').FieldFloat;

// The field registry is the place in which the web client look up when it needs
// to instantiate a field widget.
var fieldRegistry = require('web.field_registry');

// we create here a sub widget, where we simply override the _parseValue method
// to obtain the desired custom behaviour.  See abstract_field.js for a complete
// description of field widget
var LargeFloatWidget = FieldFloat.extend({
    /**
     * We override parseValue to add support for some multipliers.  For example,
     * if the user enters '3k', it should parse it as 3000.0
     *
     * Note that this is quite rudimentary support.  This widget is only here as
     * a short demonstration on how to create new type of widgets
     *
     * @private
     * @override
     */
    _parseValue: function (value) {
        var multiplier = 1;
        var lastChar =  value[value.length - 1];
        if (lastChar === 'k' || lastChar === 'K') {
                multiplier = 1000;
                value = value.slice(0, -1);
        }
        if (lastChar === 'm' || lastChar === 'M') {
                multiplier = 1000000;
                value = value.slice(0, -1);
        }
        return multiplier * this._super(value);
    },
});

// by adding our own widget to the registry, it is now available to the web
// client.  In order to use it in a given form view, we now just need to add
// the 'widget' attribute to a field in a form view.  For example, it could
// look like
//                  <field name="amount" widget="large_float"/>
//
// Note that the value for the widget attribute has to be the same as the key
// used to add the widget in the registry.  Also, such widgets will work in
// list and kanban views as well.
fieldRegistry.add('large_float', LargeFloatWidget);


// In this file, we showed how to add a new type of widget.  But in some case,
// a better solution may be to change the FieldFloat widget in place.  The
// difference is that in that case, we change the core behaviour of the float
// widget, and we do not need to add widget="large_float" to every field that
// we want to customize.
//
// In that case, we do not need to create a new subwidget and we do not need to
// add it to the registry.  The only thing to do is to 'include' it:
//
// FieldFloat.include({
//     _parseValue: function (value) {
//         ...
//     }.
// });
//
// This modifies the widget in place (also known as 'monkey-patching').  I think
// that most of the time, this is not what we want, but maybe it could simplify
// some project.

});