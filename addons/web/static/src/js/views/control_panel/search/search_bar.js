odoo.define('web.SearchBar', function (require) {
"use strict";

var AutoComplete = require('web.AutoComplete');
var AutoCompleteSources = require('web.SearchBarAutoCompleteSources');
var core = require('web.core');
var SearchBarInput = require('web.SearchBarInput');
var SearchFacet = require('web.SearchFacet');
var Widget = require('web.Widget');

var SearchBar = Widget.extend({
    template: 'SearchView.SearchBar',
    /**
     * @override
     * @param {Object} [params]
     * @param {Object} [params.context]
     * @param {Object[]} [params.facets]
     * @param {Object} [params.fields]
     * @param {Object[]} [params.filterFields]
     * @param {Object[]} [params.filters]
     * @param {Object[]} [params.groupBys]
     */
    init: function (parent, params) {
        this._super.apply(this, arguments);

        this.context = params.context;

        this.facets = params.facets;
        this.fields = params.fields;
        this.filters = params.filters;
        this.filterFields = params.filterFields;
        this.groupBys = params.groupBys;

        this.autoCompleteSources = [];
    },
    /**
     * @override
     */
    start: function () {
        var self = this;
        var defs = [this._super.apply(this, arguments)];
        _.each(this.facets, function (facet) {
            defs.push(self._renderFacet(facet));
        });
        defs.push(this._renderInput());
        defs.push(this._setupAutoCompletion());
        return $.when.apply($, defs);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Provide auto-completion result for req.term.
     *
     * @private
     * @param {Object} req request to complete
     * @param {String} req.term searched term to complete
     * @param {Function} callback
     */
    _getAutoCompleteSources: function (req, callback) {
        var defs = _.invoke(this.autoCompleteSources, 'getAutocompletionValues', req.term);
        $.when.apply($, defs).then(function () {
            callback(_(arguments).chain()
                .compact()
                .flatten(true)
                .value());
            });
    },
    /**
     * @param {Object} facet
     * @private
     */
    _renderFacet: function (facet) {
        this.searchFacet = new SearchFacet(this, facet);
        return this.searchFacet.appendTo(this.$el);
    },
    /**
     * @private
     */
    _renderInput: function () {
        this.input = new SearchBarInput(this);
        return this.input.appendTo(this.$el);
    },
    /**
     * @private
     */
    _setupAutoCompletion: function () {
        var self = this;
        this._setupAutoCompletionWidgets();
        this.autoComplete = new AutoComplete(this, {
            source: this._getAutoCompleteSources.bind(this),
            select: this._onAutoCompleteSelected.bind(this),
            get_search_string: function () {
                return self.input.$el.val().trim();
            },
        });
        return this.autoComplete.appendTo(this.$el);
    },
    /**
     * @private
     */
    _setupAutoCompletionWidgets: function () {
        var self = this;
        _.each(this.filterFields, function (filter) {
            var field = self.fields[filter.attrs.name];
            var Obj = core.search_widgets_registry.getAny([filter.attrs.widget, field.type]);
            if (Obj) {
                self.autoCompleteSources.push(new (Obj) (self, filter, field, self.context));
            }
        });
        _.each(this.filters, function (filter) {
            self.autoCompleteSources.push(new AutoCompleteSources.Filter(self, filter));
        });
        _.each(this.groupBys, function (filter) {
            self.autoCompleteSources.push(new AutoCompleteSources.GroupBy(self, filter));
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Event} e
     * @param {Object} ui
     * @param {Object} ui.item selected completion item
     */
    _onAutoCompleteSelected: function (e, ui) {
        e.preventDefault();
        var filter = ui.item.facet.filter;
        if (filter.type === 'field') {
            var values = filter.autoCompleteValues;
            values.push(ui.item.facet.values[0]);
            this.trigger_up('autocompletion_filter', {
                filterId: filter.id,
                autoCompleteValues: values,
            });
        } else {
            this.trigger_up('autocompletion_filter', {
                filterId: filter.id,
            });
        }
    },
});

return SearchBar;

});