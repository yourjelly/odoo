odoo.define('web.SearchBarAutoCompleteWidgets', function (require) {
"use strict";

var core = require('web.core');
var Domain = require('web.Domain');
var field_utils = require('web.field_utils');
var pyUtils = require('web.py_utils');
var time = require('web.time');
var Widget = require('web.Widget');

var _t = core._t;
var _lt = core._lt;

// TODO: no need to be a widget ; a Class with parented mixin(?) is enough
var FilterInterface = Widget.extend({
    completion_label: _lt("%s"),
    init: function (parent, filter) {
        this._super.apply(this, arguments);
        this.filter = filter;
    },
    getAutocompletionValues: function (item) {
        var result;
        item = item.toLowerCase();
        if (fuzzy.test(item, this.filter.description)) {
            result = [{
                label: _.str.sprintf(this.completion_label.toString(),
                                         _.escape(this.filter.description)),
                facet: {
                    filter: this.filter,
                },
            }];
        }
        return $.when(result);
    },
});

var Filter = FilterInterface.extend({
    completion_label: _lt("Filter on: %s"),
});

var GroupBy = FilterInterface.extend({
    completion_label: _lt("Group by: %s"),
});

var Field = FilterInterface.extend({
    default_operator: '=',
    /**
     * @override
     * @param {Object} field
     * @param {Object} filter
     * @param {Object} context needed for extra rpc (i.e. m2o)
     */
    init: function (parent, filter, field, context) {
        this._super.apply(this, arguments);
        this.field = field;
        this.filter = filter;
        // TODO: this is a bit four-tout
        this.attrs = _.extend({}, field, filter.attrs);
        this.context = context;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Fetch auto-completion values for the widget.
     *
     * The completion values should be an array of objects with keys category,
     * label, value prefixed with an object with keys type=section and label
     *
     * @param {String} value value to getAutocompletionValues
     * @returns {jQuery.Deferred<null|Array>}
     */
    getAutocompletionValues: function (value) {
        // the returned value will be used by search_bar in @_onAutoCompleteSelected
        return $.when([{
            label: this._getAutocompletionLabel(value),
            facet: this._getFacetValue(value),
        }]);
    },
    /**
     * @TODO
     * @param {Object[]} values
     * @returns {string}
     */
    getDomain: function (values) {
        if (!values.length) { return; }

        var value_to_domain;
        var self = this;
        var domain = this.attrs.filter_domain;
        if (domain) {
            value_to_domain = function (facetValue) {
                return Domain.prototype.stringToArray(
                    domain,
                    {self: self._valueFrom(facetValue), raw_value: facetValue.value}  // TODO: what is that?
                );
            };
        } else {
            value_to_domain = function (facetValue) {
                return self._makeDomain(
                    self.attrs.name,
                    self.attrs.operator || self.default_operator,
                    facetValue
                );
            };
        }
        var domains = values.map(value_to_domain);

        domains = domains.map(Domain.prototype.arrayToString);
        return pyUtils.assembleDomains(domains, 'OR');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {any} value
     * @returns {string}
     */
    _getAutocompletionLabel: function (value) {
        return _.str.sprintf(_.str.escapeHTML(
            _t("Search %(field)s for: %(value)s")), {
                field: '<em>' + _.escape(this.attrs.string) + '</em>',
                value: '<strong>' + _.escape(value) + '</strong>'});
    },
    /**
     * @private
     * @param {any} value
     * @returns {Object}
     */
    _getFacetValue: function (value) {
        return {
            filter: this.filter,
            values: [{label: value, value: value}],
        };
    },
    /**
     * Function creating the returned domain for the field, override this
     * methods in children if you only need to customize the field's domain
     * without more complex alterations or tests (and without the need to
     * change override the handling of filter_domain)
     *
     * @private
     * @param {String} name the field's name
     * @param {String} operator the field's operator (either attribute-specified or default operator for the field
     * @param {Number|String} facet parsed value for the field
     * @returns {Array<Array>} domain to include in the resulting search
     */
    _makeDomain: function (name, operator, facet) {
        return [[name, operator, this._valueFrom(facet)]];
    },
    /**
     * @private
     * @param {Object} facetValue
     * @param {any} facetValue.value
     * @returns {any}
     */
    _valueFrom: function (facetValue) {
        return facetValue.value;
    },
});

var CharField = Field.extend({
    default_operator: 'ilike',

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    getAutocompletionValues: function (value) {
        if (_.isEmpty(value)) { return $.when(null); }
        return this._super.apply(this, arguments);
    }
});

var NumberField = Field.extend({

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    getAutocompletionValues: function (value) {
        var val = this.parse(value);
        if (isNaN(val)) { return $.when(); }
        return this._super.apply(this, arguments);
    },
});

var IntegerField = NumberField.extend({
    error_message: _t("not a valid integer"),
    parse: function (value) {
        try {
            return field_utils.parse.integer(value);
        } catch (e) {
            return NaN;
        }
    }
});

var FloatField = NumberField.extend({
    error_message: _t("not a valid number"),
    parse: function (value) {
        try {
            return field_utils.parse.float(value);
        } catch (e) {
            return NaN;
        }
    }
});

/**
 * @class
 * @extends instance.web.search.Field
 */
var SelectionField = Field.extend({
    // TODO
    // This implementation is a basic <select> field, but it may have to be
    // altered to be more in line with the GTK client, which uses a combo box
    // (~ jquery.autocomplete):
    // * If an option was selected in the list, behave as currently
    // * If something which is not in the list was entered (via the text input),
    //   the default domain should become (`ilike` string_value) but **any
    //   ``context`` or ``filter_domain`` becomes falsy, idem if ``@operator``
    //   is specified. So at least getDomain needs to be quite a bit
    //   overridden (if there's no @value and there is no filter_domain and
    //   there is no @operator, return [[name, 'ilike', str_val]]
    init: function () {
        this._super.apply(this, arguments);
        // prepend empty option if there is no empty option in the selection list
        this.prepend_empty = !_(this.attrs.selection).detect(function (item) {
            return !item[1];
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    getAutocompletionValues: function (needle) {
        var self = this;
        var results = _(this.attrs.selection).chain()
            .filter(function (sel) {
                var value = sel[0], label = sel[1];
                if (value === undefined || !label) { return false; }
                return label.toLowerCase().indexOf(needle.toLowerCase()) !== -1;
            })
            .map(function (sel) {
                return {
                    label: _.escape(sel[1]),
                    indent: true,
                    facet: self._getFacetValue(sel)
                };
            }).value();
        if (_.isEmpty(results)) { return $.when(null); }
        return $.when.call(null, [{
            label: _.escape(this.attrs.string)
        }].concat(results));
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {any} value
     * @returns {Object}
     */
    _getFacetValue: function (value) {
        return {
            filter: this.filter,
            values: [{label: value[1], value: value[0]}],
        };
    },
});

var BooleanField = SelectionField.extend({
    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this.attrs.selection = [
            [true, _t("Yes")],
            [false, _t("No")]
        ];
    }
});

var DateField = Field.extend({
    /**
     * @override
     */
    getAutocompletionValues: function (value) {
        // Make sure the value has a correct format before the creation of the moment object. See
        // issue https://github.com/moment/moment/issues/1407
        var t, v;
        try {
            t = (this.attrs && this.attrs.type === 'datetime') ? 'datetime' : 'date';
            v = field_utils.parse[t](value, {type: t}, {timezone: true});
        } catch (e) {
            return $.when(null);
        }

        var m = moment(v, t === 'datetime' ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD');
        if (!m.isValid()) { return $.when(null); }
        var dateString = field_utils.format[t](m, {type: t});
        var label = this._getAutocompletionLabel(dateString);
        var facet = this._getFacetValue(dateString, m.toDate());
        return $.when([{
            label: label,
            facet: facet,
        }]);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _valueFrom: function (facetValue) {
        return time.date_to_str(facetValue.value);
    },
    /**
     * @override
     */
    _getAutocompletionLabel: function (value) {
        return _.str.sprintf(_.str.escapeHTML(
            _t("Search %(field)s at: %(value)s")), {
                field: '<em>' + _.escape(this.attrs.string) + '</em>',
                value: '<strong>' + value + '</strong>'});
    },
    /**
     * @override
     * @param {any} rawValue
     */
    _getFacetValue: function (value, rawValue) {
        var facet = this._super.apply(this, arguments);
        facet.values[0].value = rawValue;
    },
});

/**
 * Implementation of the ``datetime`` openerp field type:
 *
 * * Uses the same widget as the ``date`` field type (a simple date)
 *
 * * Builds a slighly more complex, it's a datetime range (includes time)
 *   spanning the whole day selected by the date widget
 *
 * @class
 * @extends instance.web.DateField
 */
var DateTimeField = DateField.extend({
    _valueFrom: function (facetValue) {
        return time.datetime_to_str(facetValue.value);
    }
});

var ManyToOneField = CharField.extend({
    default_operator: {},
    /**
     * @override
     */
    getAutocompletionValues: function (value) {
        if (_.isEmpty(value)) { return $.when(null); }
        var label = this._getAutocompletionLabel(value);
        return $.when([{
            label: label,
            facet: this._getFacetValue(value),
            expand: this._expand.bind(this),
        }]);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    _getFacetValue: function (value) {
        return {
            filter: this.filter,
            values: [{label: value, value: value, operator: 'ilike'}],
        };
    },
    _getExpandedFacetValue: function (value) {
        return {
            filter: this.filter,
            values: [{label: value[1], value: value[0]}],
        };
    },
    _expand: function (needle) {
        var self = this;
        var args = this.attrs.domain;
        if (typeof args === 'string') {
            try {
                args = Domain.prototype.stringToArray(args);
            } catch(e) {
                args = [];
            }
        }
        return this._rpc({
                model: this.attrs.relation,
                method: 'name_search',
                kwargs: {
                    name: needle,
                    args: args,
                    limit: 8,
                    context: this.context,
                },
            })
            .then(function (results) {
                if (_.isEmpty(results)) { return null; }
                return _(results).map(function (result) {
                    return {
                        label: _.escape(result[1]),
                        facet: self._getExpandedFacetValue(result)
                    };
                });
            });
    },
    _valueFrom: function (facetValue) {
        return facetValue.label;
    },
    _makeDomain: function (name, operator, facetValue) {
        operator = facetValue.operator || operator;

        switch(operator){
        case this.default_operator:
            return [[name, '=', facetValue.value]];
        case 'ilike':
            return [[name, 'ilike', facetValue.value]];
        case 'child_of':
            return [[name, 'child_of', facetValue.value]];
        }
        return this._super(name, operator, facetValue);
    },
});

core.search_widgets_registry
    .add('char', CharField)
    .add('text', CharField)
    .add('html', CharField)
    .add('boolean', BooleanField)
    .add('integer', IntegerField)
    .add('id', IntegerField)
    .add('float', FloatField)
    .add('monetary', FloatField)
    .add('selection', SelectionField)
    .add('datetime', DateTimeField)
    .add('date', DateField)
    .add('many2one', ManyToOneField)
    .add('many2many', CharField)
    .add('one2many', CharField);

return {
    GroupBy: GroupBy,
    Filter: Filter,
};

});
