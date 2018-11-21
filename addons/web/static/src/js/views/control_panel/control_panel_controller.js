odoo.define('web.ControlPanelController', function (require) {
"use strict";

var mvc = require('web.mvc');

var ControlPanelController = mvc.Controller.extend({
    className: 'o_cp_controller',
    custom_events: {
        button_clicked: '_onButtonClicked',
        facet_removed: '_onFacetRemoved',
        get_non_evaluated_query: '_onGetNonEvaluatedQuery',
        item_option_clicked: '_onItemOptionClicked',
        item_trashed: '_onItemTrashed',
        menu_item_clicked: '_onMenuItemClicked',
        new_favorite: '_onNewFavorite',
        new_filters: '_onNewFilters',
        new_groupBy: '_onNewGroupBy',
        activate_time_range: '_onActivateTimeRange',
        autocompletion_filter: '_onAutoCompletionFilter',
    },

    /**
     * @override
     */
    init: function (parent, model, renderer, params) {
        this._super.apply(this, arguments);

        this.modelName = params.modelName;

        // the updateIndex is used to prevent concurrent updates of the control
        // panel depending on asynchronous code to be executed in the wrong order
        this.updateIndex = 0;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    configure: function (configuration) {
        var defs = [];
        this.model.configure(configuration);
        var state = this.model.get();
        defs.push(this.getSearchState());
        defs.push(this.renderer.updateState(state));
        return $.when(defs).then(function (defsResults) {
            return defsResults[0];
        });
    },
    /**
     * Compute the search related values that will be
     *
     * @returns {Object} object with keys 'context', 'domain', 'groupBy'
     */
    getSearchState: function () {
        return this.model.getQuery();
    },
    getConfiguration: function () {
        return this.model.getConfiguration();
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
     * Updates the content and displays the ControlPanel
     *
     * @see  ControlPanelRenderer (update)
     */
    updateContents: function (status, options) {
        this.updateIndex++;
        this.renderer.render(status, options);
    },
    /**
     * Updates the domain of the search view by adding and/or removing filters.
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

    _getSubMenus: function () {
        return this.renderer.$subMenus;
    },
    _reportNewQueryAndRender: function () {
        this.trigger_up('search', this.model.getQuery());
        var state = this.model.get();
        return this.renderer.updateState(state);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onActivateTimeRange: function (event) {
        this.model.activateTimeRange(
            event.data.id,
            event.data.timeRangeId,
            event.data.comparisonTimeRangeId
        );
        this._reportNewQueryAndRender();
    },
    _onAutoCompletionFilter: function (event) {
        this.model.toggleAutoCompletionFilter(event.data);
        this._reportNewQueryAndRender();
    },
    /**
     * @private
     * @param {OdooEvent} ev
     */
    _onButtonClicked: function (ev) {
        ev.stopPropagation();
        this.trigger_up('execute_action', {
            action_data: ev.data.attrs,
            env: {
                context: {},
                model: this.modelName,
            },
        });
    },
    _onFacetRemoved: function (event) {
        var group = event.data.group;
        if (!group) {
            group = this.renderer.getLastFacet();
        }
        this.model.deactivateGroup(group.id);
        this._reportNewQueryAndRender();
    },
    _onGetNonEvaluatedQuery: function (event) {
        // getSearchState gives evaluated query! we should change methods
        var query = this.getSearchState();
        event.data.callback(query);
    },
    _onItemOptionClicked: function (event) {
        this.model.toggleFilterWithOptions(event.data.id, event.data.optionId);
        this._reportNewQueryAndRender();
    },
    _onItemTrashed: function (event) {
        var def = this.model.deleteFilterEverywhere(event.data.id);
        def.then(this._reportNewQueryAndRender.bind(this));
    },
    _onMenuItemClicked: function (event) {
        // important in case of view graph. It uses the GroupByMenuInterfaceMixin!
        event.stopPropagation();
        this.model.toggleFilter(event.data.id);
        this._reportNewQueryAndRender();
    },
    _onNewFavorite: function (event) {
        var def = this.model.createNewFavorite(event.data);
        def.then(this._reportNewQueryAndRender.bind(this));
    },
    _onNewFilters: function (event) {
        this.model.createNewFilters(event.data.filters);
        this._reportNewQueryAndRender();
    },
    _onNewGroupBy: function (event) {
        this.model.createNewGroupBy(event.data);
        this._reportNewQueryAndRender();
    },
});

return ControlPanelController;

});
