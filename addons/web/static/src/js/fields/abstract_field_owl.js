odoo.define('web.AbstractFieldOwl', function (require) {
    "use strict";

const field_utils = require('web.field_utils');

const { ComponentWrapper } = require('web.OwlCompatibility');

class AbstractFieldOwl extends owl.Component {
    constructor(parent, props) {
        super(parent, props);

        const options = props.options || {};
        const record = props.record;
        // 'name' is the field name displayed by this widget
        this.name = props.fieldName;

        // the datapoint fetched from the model
        this.record = record;

        // the 'field' property is a description of all the various field properties,
        // such as the type, the comodel (relation), ...
        this.field = record.fields[this.name];

        // the 'viewType' is the type of the view in which the field widget is
        // instantiated. For standalone widgets, a 'default' viewType is set.
        this.viewType = options.viewType || 'default';

        // the 'attrs' property contains the attributes of the xml 'field' tag,
        // the inner views...
        var fieldsInfo = record.fieldsInfo[this.viewType];
        this.attrs = options.attrs || (fieldsInfo && fieldsInfo[this.name]) || {};

        // the 'additionalContext' property contains the attributes to pass through the context.
        this.additionalContext = options.additionalContext || {};

        // this property tracks the current (parsed if needed) value of the field.
        // Note that we don't use an event system anymore, using this.get('value')
        // is no longer valid.
        this.value = record.data[this.name];

        // recordData tracks the values for the other fields for the same record.
        // note that it is expected to be mostly a readonly property, you cannot
        // use this to try to change other fields value, this is not how it is
        // supposed to work. Also, do not use this.recordData[this.name] to get
        // the current value, this could be out of sync after a _setValue.
        this.recordData = record.data;

        // the 'string' property is a human readable (and translated) description
        // of the field. Mostly useful to be displayed in various places in the
        // UI, such as tooltips or create dialogs.
        this.string = this.attrs.string || this.field.string || this.name;

        // Widget can often be configured in the 'options' attribute in the
        // xml 'field' tag.  These options are saved (and evaled) in nodeOptions
        this.nodeOptions = this.attrs.options || {};

        // dataPointID is the id corresponding to the current record in the model.
        // Its intended use is to be able to tag any messages going upstream,
        // so the view knows which records was changed for example.
        this.dataPointID = record.id;

        // this is the res_id for the record in database.  Obviously, it is
        // readonly.  Also, when the user is creating a new record, there is
        // no res_id.  When the record will be created, the field widget will
        // be destroyed (when the form view switches to readonly mode) and a new
        // widget with a res_id in mode readonly will be created.
        this.res_id = record.res_id;

        // useful mostly to trigger rpcs on the correct model
        this.model = record.model;

        // a widget can be in two modes: 'edit' or 'readonly'.  This mode should
        // never be changed, if a view changes its mode, it will destroy and
        // recreate a new field widget.
        this.mode = options.mode || "readonly";

        // this flag tracks if the widget is in a valid state, meaning that the
        // current value represented in the DOM is a value that can be parsed
        // and saved.  For example, a float field can only use a number and not
        // a string.
        this._isValid = true;

        // this is the last value that was set by the user, unparsed.  This is
        // used to avoid setting the value twice in a row with the exact value.
        this.lastSetValue = undefined;

        // formatType is used to determine which format (and parse) functions
        // to call to format the field's value to insert into the DOM (typically
        // put into a span or an input), and to parse the value from the input
        // to send it to the server. These functions are chosen according to
        // the 'widget' attrs if is is given, and if it is a valid key, with a
        // fallback on the field type, ensuring that the value is formatted and
        // displayed according to the chosen widget, if any.
        this.formatType = this.attrs.widget in field_utils.format ?
                            this.attrs.widget :
                            this.field.type;
        // formatOptions (resp. parseOptions) is a dict of options passed to
        // calls to the format (resp. parse) function.
        this.formatOptions = {};
        this.parseOptions = {};

        // if we add decorations, we need to reevaluate the field whenever any
        // value from the record is changed
        if (this.attrs.decorations) {
            this.resetOnAnyFieldChange = true;
        }
    }
    async willUpdateProps(nextProps) {
        this.record = nextProps.record;
        this.recordData = this.record.data;
        this.value = this.recordData[this.name];
        this.lastSetValue = undefined;
    }

    async commitChanges() {}
    isSet() {
        return !!this.value;
    }
    isValid() {
        return this._isValid;
    }
}

return AbstractFieldOwl;

});