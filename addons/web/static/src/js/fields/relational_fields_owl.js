odoo.define('web.relational_fields_owl', function (require) {
    "use strict";

    const relational_fields = require('web.relational_fields');
    const { FieldAdapter, WidgetAdapterMixin } = require('web.OwlCompatibility');


    let classes = {}

    _.filter(_.keys(relational_fields), key => key.startsWith('Field')).forEach(name => {
        classes[name] = class extends FieldAdapter {
            updateWidget() {}
            renderWidget() {}
        };
        classes[name].defaultProps = {Component: _.extend(relational_fields[name], WidgetAdapterMixin)};
    })

    return classes
});
