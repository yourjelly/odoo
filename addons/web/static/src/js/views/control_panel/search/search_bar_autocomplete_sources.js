odoo.define('web.SearchBarAutoCompleteSources', function (require) {
"use strict";

var Class = require('web.Class');
var core = require('web.core');
var field_utils = require('web.field_utils');
var mixins = require('web.mixins');
var ServicesMixin = require('web.ServicesMixin');
var time = require('web.time');

var _t = core._t;
var _lt = core._lt;

var FilterInterface = Class.extend(mixins.EventDispatcherMixin, {
    completion_label: _lt("%s"),
    /**
     * @override
     * @param {Object} filter
     */
    init: function (parent, filter) {
        mixins.EventDispatcherMixin.init.call(this);
        this.setParent(parent);

        this.filter = filter;
    },
    /**
     * Fetch auto-completion values for the widget.
     *
     * The completion values should be an array of objects with keys facet and
     * label. They will be used by search_bar in @_onAutoCompleteSelected.
     *
     * @param {string} value value to getAutocompletionValues
     * @returns {Deferred<null|Array>}
     */
    getAutocompletionValues: function (value) {
        var result;
        value = value.toLowerCase();
        if (fuzzy.test(value, this.filter.description)) {
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

var Field = FilterInterface.extend(ServicesMixin, {
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
        this.attrs = _.extend({}, field, filter.attrs);
        this.context = context;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    getAutocompletionValues: function (value) {
        return $.when([{
            label: this._getAutocompletionLabel(value),
            facet: this._getFacetValue(value),
        }]);
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
});

var CharField = Field.extend({

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    getAutocompletionValues: function (value) {
        if (_.isEmpty(value)) { return $.when(null); }
        return this._super.apply(this, arguments);
    },
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
    parse: function (value) {
        try {
            return field_utils.parse.integer(value);
        } catch (e) {
            return NaN;
        }
    },
});

var FloatField = NumberField.extend({
    parse: function (value) {
        try {
            return field_utils.parse.float(value);
        } catch (e) {
            return NaN;
        }
    },
});

var SelectionField = Field.extend({

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    getAutocompletionValues: function (value) {
        var self = this;
        var results = _(this.attrs.selection).chain()
            .filter(function (sel) {
                var selValue = sel[0], label = sel[1];
                if (selValue === undefined || !label) { return false; }
                return label.toLowerCase().indexOf(value.toLowerCase()) !== -1;
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
    },
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
        return facet;
    },
});

var ManyToOneField = CharField.extend({
    default_operator: {},

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

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
    _getExpandedFacetValue: function (value) {
        return {
            filter: this.filter,
            values: [{label: value[1], value: value[0]}],
        };
    },
    /**
     * @override
     */
    _getFacetValue: function (value) {
        return {
            filter: this.filter,
            values: [{label: value, value: value, operator: 'ilike'}],
        };
    },
    /**
     * @override
     */
    _expand: function (value) {
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
                    name: value,
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
});

return {
    BooleanField: BooleanField,
    CharField: CharField,
    DateField: DateField,
    DateTimeField: DateField,
    Field: Field,
    Filter: Filter,
    FloatField: FloatField,
    GroupBy: GroupBy,
    IntegerField: IntegerField,
    ManyToOneField: ManyToOneField,
    NumberField: NumberField,
    SelectionField: SelectionField,
};

});
