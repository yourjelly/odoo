odoo.define('web.ControlPanelController', function (require) {
"use strict";

var mvc = require('web.mvc');
var Domain = require('web.Domain');
var search_filters_registry = require('web.search_filters_registry');

var ControlPanelController = mvc.Controller.extend({
    className: 'o_cp_controller',
    custom_events: {
        facet_removed: '_onFacetRemoved',
        get_search_query: '_onGetSearchQuery',
        item_option_clicked: '_onItemOptionClicked',
        item_trashed: '_onItemTrashed',
        menu_item_clicked: '_onMenuItemClicked',
        new_favorite: '_onNewFavorite',
        new_filters: '_onNewFilters',
        new_groupBy: '_onNewGroupBy',
        activate_time_range: '_onActivateTimeRange',
        autocompletion_filter: '_onAutoCompletionFilter',
        decompose_filter: '_onClickDecomposeFilter'
    },

    /**
     * @override
     * @param {Object} params
     * @param {string} params.modelName
     */
    init: function (parent, model, renderer, params) {
        this._super.apply(this, arguments);

        this.modelName = params.modelName;
    },
    /**
     * Called when the control panel is inserted into the DOM.
     */
    on_attach_callback: function () {
        this.renderer.on_attach_callback();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @see ControlPanelModel (exportState)
     * @returns {Object}
     */
    exportState: function () {
        return this.model.exportState();
    },
    /**
     * Compute the search related values that will be used to fetch data.
     *
     * @returns {Object} object with keys 'context', 'domain', 'groupBy'
     */
    getSearchQuery: function () {
        return this.model.getQuery();
    },
    /**
     * @param {Object} state a ControlPanelModel state
     * @returns {Deferred<Object>} the result of `getSearchState`
     */
    importState: function (state) {
        var defs = [];
        this.model.importState(state);
        defs.push(this.getSearchQuery());
        defs.push(this.renderer.updateState(this.model.get()));
        return $.when(defs).then(function (defsResults) {
            return defsResults[0];
        });
    },
    /**
     * Called at each switch view. This is required until the control panel is
     * shared between controllers of an action.
     *
     * @param {string} controllerID
     */
    setControllerID: function (controllerID) {
        this.controllerID = controllerID;
    },
    /**
     * Update the content and displays the ControlPanel.
     *
     * @see  ControlPanelRenderer (updateContents)
     * @param {Object} status
     * @param {Object} [options]
     */
    updateContents: function (status, options) {
        this.renderer.updateContents(status, options);
    },
    /**
     * Update the domain of the search view by adding and/or removing filters.
     *
     * @todo: the way it is done could be improved, but the actual state of the
     * searchview doesn't allow to do much better.

     * @param {Object[]} newFilters list of filters to add, described by
     *   objects with keys domain (the domain as an Array), description (the text
     *   to display in the facet) and type with value 'filter'.
     * @param {string[]} filtersToRemove list of filter ids to remove
     *   (previously added ones)
     * @returns {string[]} list of added filters (to pass as filtersToRemove
     *   for a further call to this function)
     */
    updateFilters: function (newFilters, filtersToRemove) {
        var newFilterIDS = this.model.createNewFilters(newFilters);
        this.model.deactivateFilters(filtersToRemove);
        this._reportNewQueryAndRender();
        return newFilterIDS;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @returns {jQuery}
     */
    _getSubMenus: function () {
        return this.renderer.$subMenus;
    },
    /**
     * @private
     * @returns {Deferred}
     */
    _reportNewQueryAndRender: function () {
        this.trigger_up('search', this.model.getQuery());
        var state = this.model.get();
        return this.renderer.updateState(state);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onActivateTimeRange: function (ev) {
        ev.stopPropagation();
        this.model.activateTimeRange(
            ev.data.id,
            ev.data.timeRangeId,
            ev.data.comparisonTimeRangeId
        );
        this._reportNewQueryAndRender();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onAutoCompletionFilter: function (ev) {
        ev.stopPropagation();
        this.model.toggleAutoCompletionFilter(ev.data);
        this._reportNewQueryAndRender();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onClickDecomposeFilter: function (ev) {
        ev.stopPropagation();
        var stringToArray = Domain.prototype.stringToArray(ev.data.domain);
        var domain = this._filterDomain(stringToArray);
        var clonedStringToArray = $.extend(true, [], stringToArray);
        var description = this._filterDescription(clonedStringToArray);
        var filters = [];
        var check = false;
        for (var i=0; i<domain.length; i++) {
            if (check) {
                this.model.createNewFilters([{
                type: 'filter',
                domain: Domain.prototype.arrayToString([domain[i]]),
                description: description[i].toString(),
            }]);
                check = false
                continue
            }
            if (domain[i] == '|' || domain[i] == '&') {
                if (domain[i] == '&') {check=true}
                continue;
            }
            filters.push({
                type: 'filter',
                domain: Domain.prototype.arrayToString([domain[i]]),
                description: description[i].toString(),
            });
        }
        this.model.createNewFilters(filters);
        this._reportNewQueryAndRender();
    },

    _filterDomain: function (domainFilter) {
        var operator = [];
        var domain = [];
        for (var i=0; i<domainFilter.length; i++) {
            if (domainFilter[i] == '&' || domainFilter[i] == '|') {
                operator.push(domainFilter[i]);
            }
            else {
                domain.push(domainFilter[i]);
                if (operator.length > 0) {
                    var pop_operator = operator.pop();
                    domain.push(pop_operator);
                }
            }
        }
        return domain;
    },

    _filterDescription: function (descroptionFilter) {
        var operator = [];
        var description = [];
        var fields = this.__parentedParent.initialState.fields;
        for (var i=0; i<descroptionFilter.length; i++) {
            if (descroptionFilter[i] == '&' || descroptionFilter[i] == '|') {
                operator.push(descroptionFilter[i]);
            }
            else {
                var field_type = fields[descroptionFilter[i][0]].type;
                for (var j=0; j<descroptionFilter[i].length; j++) {
                    if (j == 0) {
                        descroptionFilter[i][j] = fields[descroptionFilter[i][j]].string;
                    }
                    if (j == 1) {
                        var operator_field = search_filters_registry.getAny([field_type, "char"]).prototype.operators;
                        for (var k=0; k<operator_field.length; k++) {
                            if (descroptionFilter[i][j] == operator_field[k].value) {
                                descroptionFilter[i][j] = operator_field[k].text.toString();
                                break;
                            }
                        }
                    }
                }
                description.push(descroptionFilter[i]);
                if (operator.length > 0) {
                    var pop_operator = operator.pop();
                    description.push(pop_operator);
                }
            }
        }
        return description;
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onFacetRemoved: function (ev) {
        ev.stopPropagation();
        var group = ev.data.group;
        if (!group) {
            group = this.renderer.getLastFacet();
        }
        this.model.deactivateGroup(group.id);
        this._reportNewQueryAndRender();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onGetSearchQuery: function (ev) {
        ev.stopPropagation();
        var query = this.getSearchQuery();
        ev.data.callback(query);
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onItemOptionClicked: function (ev) {
        ev.stopPropagation();
        this.model.toggleFilterWithOptions(ev.data.id, ev.data.optionId);
        this._reportNewQueryAndRender();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onItemTrashed: function (ev) {
        ev.stopPropagation();
        var def = this.model.deleteFilterEverywhere(ev.data.id);
        def.then(this._reportNewQueryAndRender.bind(this));
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onMenuItemClicked: function (ev) {
        ev.stopPropagation();
        this.model.toggleFilter(ev.data.id);
        this._reportNewQueryAndRender();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onNewFavorite: function (ev) {
        ev.stopPropagation();
        var def = this.model.createNewFavorite(ev.data);
        def.then(this._reportNewQueryAndRender.bind(this));
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onNewFilters: function (ev) {
        ev.stopPropagation();
        this.model.createNewFilters(ev.data.filters);
        this._reportNewQueryAndRender();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onNewGroupBy: function (ev) {
        ev.stopPropagation();
        this.model.createNewGroupBy(ev.data);
        this._reportNewQueryAndRender();
    },
});

return ControlPanelController;

});
