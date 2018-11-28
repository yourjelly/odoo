odoo.define('web.ControlPanelModel', function (require) {
"use strict";

var controlPanelViewParameters = require('web.controlPanelViewParameters');
var core = require('web.core');
var Domain = require('web.Domain');
var mvc = require('web.mvc');
var pyUtils = require('web.py_utils');
var session = require('web.session');

var _t = core._t;

var DEFAULT_TIMERANGE = controlPanelViewParameters.DEFAULT_TIMERANGE;
var TIME_RANGE_OPTIONS = controlPanelViewParameters.TIME_RANGE_OPTIONS;
var COMPARISON_TIME_RANGE_OPTIONS = controlPanelViewParameters.COMPARISON_TIME_RANGE_OPTIONS;

var ControlPanelModel = mvc.Model.extend({
    /**
     * @override
     * @param {string} [params.context={}]
     * @param {string} [params.domain=[]]
     */
    init: function (parent, params) {
        this._super.apply(this, arguments);

        TIME_RANGE_OPTIONS = TIME_RANGE_OPTIONS.map(function (option) {
            return _.extend(option, {description: option.description.toString()});
        });
        COMPARISON_TIME_RANGE_OPTIONS = COMPARISON_TIME_RANGE_OPTIONS.map(function (option) {
            return _.extend(option, {description: option.description.toString()});
        });

        this.initialContext = params.context || {};
        this.initialDomain = params.domain || [];

        this.filters = {};
        this.groups = {};
        this.query = [];
        this.fields = {};
        this.modelName = null;
        this.actionId = null;
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    activateTimeRange: function (filterId, timeRangeId, comparisonTimeRangeId) {
        var filter = this.filters[filterId];
        filter.timeRangeId = timeRangeId || filter.defaultTimeRangeId;
        filter.comparisonTimeRangeId = comparisonTimeRangeId;
        var group = this.groups[filter.groupId];
        var groupActive = group.activeFilterIds.length;
        if (groupActive) {
            group.activeFilterIds = [filterId];
        } else {
            this.toggleFilter(filterId);
        }
    },
    configure: function (configuration) {
        var newConfiguration = JSON.parse(configuration);
        this.filters = newConfiguration.filters;
        this.groups = newConfiguration.groups;
        this.query = newConfiguration.query;
    },
    createNewFavorite: function (newFavorite) {
        return this._saveQuery(_.pick(
            newFavorite,
            ['description', 'isDefault', 'isShared', 'type']
        )).then(function () {
            newFavorite.on_success();
        });
    },
    createNewFilters: function (newFilters) {
        var self = this;
        var filterIDs = [];
        var groupNumber = this._generateNewGroupNumber();
        this._createGroupOfFilters(newFilters);
        newFilters.forEach(function (filter) {
            filter.groupNumber = groupNumber;
            self.toggleFilter(filter.id);
            filterIDs.push(filter.id);
        });
        return filterIDs;
    },
    createNewGroupBy: function (newGroupBy) {
        var id = _.uniqueId('__filter__');
        newGroupBy.id = id;
        newGroupBy.groupId = this._getGroupIdOfType('groupBy');
        this.filters[id] = newGroupBy;
        if (_.contains(['date', 'datetime'], newGroupBy.fieldType)) {
            this.toggleFilterWithOptions(newGroupBy.id);
        } else {
            this.toggleFilter(newGroupBy.id);
        }
    },
    deactivateFilters: function (filterIDs) {
        var self = this;
        filterIDs.forEach(function (filterID) {
            var filter = self.filters[filterID];
            var group = self.groups[filter.groupId];
            if (_.contains(group.activeFilterIds, filterID)) {
                self.toggleFilter(filterID);
            }
        });
    },
    /**
     * Remove the group from the query.
     *
     * @private
     * @param {string} groupId
     */
    deactivateGroup: function (groupId) {
        var self = this;
        var group = this.groups[groupId];
        _.each(group.activeFilterIds, function (filterId) {
            var filter = self.filters[filterId];
            // TODO: put this logic in toggleFilter 'field' type
            if (filter.autoCompleteValues) {
                filter.autoCompleteValues = [];
            }
        });
        // TODO: use toggleFilter here
        group.activeFilterIds = [];
        this.query.splice(this.query.indexOf(groupId), 1);
    },
    deleteFilterEverywhere: function (filterId) {
        var self = this;
        var filter = this.filters[filterId];
        var def = this.deleteFilter(filter.serverSideId).then(function () {
            var activeFavoriteId = self.groups[filter.groupId].activeFilterIds[0];
            var isActive = activeFavoriteId === filterId;
            if (isActive) {
                self.toggleFilter(filterId);
            }
            delete self.filters[filterId];
        });
        return def;
    },
    get: function () {
        var self = this;
        // we maintain a unique source activeFilterIds that contain information
        // on active filters. But the renderer can have more information since
        // it does not change that.
        // copy this.filters;
        // we want to give a different structure to renderer.
        // filters are filters of filter type only, groupbys are groupbys,...!
        var filterFields = [];
        var filters = [];
        var groupBys = [];
        var timeRanges = [];
        var favorites = [];
        Object.keys(this.filters).forEach(function (filterId) {
            var filter = _.extend({}, self.filters[filterId]);
            var group = self.groups[filter.groupId];
            filter.isActive = group.activeFilterIds.indexOf(filterId) !== -1;
            if (filter.type === 'field') {
                filterFields.push(filter);
            }
            if (filter.type === 'filter') {
                filters.push(filter);
            }
            if (filter.type === 'groupBy') {
                groupBys.push(filter);
            }
            if (filter.type === 'favorite') {
                favorites.push(filter);
            }
            if (filter.type === 'timeRange') {
                timeRanges.push(filter);
            }
        });
        var facets = [];
        // resolve active filters for facets
        this.query.forEach(function (groupID) {
            var group = self.groups[groupID];
            var facet = _.extend({}, group);
            facet.filters = facet.activeFilterIds.map(function (filterID) {
                return self.filters[filterID];
            });
            facets.push(facet);
        });
        favorites = _.sortBy(favorites, 'groupNumber');
        return {
            facets: facets,
            filterFields: filterFields,
            filters: filters,
            groupBys: groupBys,
            timeRanges: timeRanges,
            favorites: favorites,
            groups: this.groups,
            query: _.extend([], this.query),
            fields: this.fields,
        };
    },
    getQuery: function () {
        var userContext = session.user_context;
        var context = _.extend(
            pyUtils.eval('contexts', this._getQueryContext(), userContext),
            this._getTimeRangeMenuData(true)
        );
        var domain = Domain.prototype.stringToArray(this._getDomain(), userContext);
        // this must be done because pyUtils.eval does not know that it needs to evaluate domains within contexts
        if (context.timeRangeMenuData) {
            if (typeof context.timeRangeMenuData.timeRange === 'string') {
                context.timeRangeMenuData.timeRange = pyUtils.eval('domain', context.timeRangeMenuData.timeRange);
            }
            if (typeof context.timeRangeMenuData.comparisonTimeRange === 'string') {
                context.timeRangeMenuData.comparisonTimeRange = pyUtils.eval('domain', context.timeRangeMenuData.comparisonTimeRange);
            }
        }
        var groupBys = this._getGroupBys();
        return this._processSearchData({
            // for now action manager wants domains and contexts I would prefer
            // to use domain and context.
            domain: domain,
            context: context,
            groupBys: groupBys,
        });
    },
    getConfiguration: function () {
        return JSON.stringify({
            filters: this.filters,
            groups: this.groups,
            query: this.query,
        });
    },
    load: function (params) {
        var self = this;
        this.fields = params.fields;
        this.modelName = params.modelName;
        this.actionId = params.actionId;

        if (params.initialConfiguration) {
            // TO DO: deactive filters of bad types (groupBy if view not groupable,...)
            this.configure(params.initialConfiguration);
            return $.when();
        } else {
            params.groups.forEach(function (group) {
                self._createGroupOfFilters(group);
            });
            if (this._getGroupIdOfType('groupBy') !== undefined) {
                this._createEmptyGroup('groupBy');
            }
            this._createGroupOfTimeRanges();
            return $.when.apply($, self._loadSearchDefaults()).then(function () {
                return self._loadFavorites().then(function () {
                    if (self.query.length === 0) {
                        self._activateDefaultFilters();
                        self._activateDefaultTimeRanges(params.timeRanges);
                    }
                });
            });
        }
    },
    toggleAutoCompletionFilter: function (params) {
        var filter = this.filters[params.filterId];
        if (filter.type === 'field') {
            filter.autoCompleteValues = params.autoCompleteValues;
            // the autocompletion filter is dynamic
            filter.domain = this._setFilterDomain(filter);
            // active the filter
            var group = this.groups[filter.groupId];
            if (!group.activeFilterIds.includes(filter.id)) {
                group.activeFilterIds.push(filter.id);
                this.query.push(group.id);
            }
        } else {
            if (filter.hasOptions) {
                this.toggleFilterWithOptions(filter.id);
            } else {
                this.toggleFilter(filter.id);
            }
        }
    },
    // This method could work in batch and take a list of ids as args.
    // (it would be useful for initialization and deletion of a facet/group)
    toggleFilter: function (filterId) {
        var self = this;
        var filter = this.filters[filterId];
        var group = this.groups[filter.groupId];
        var index = group.activeFilterIds.indexOf(filterId);
        var initiaLength = group.activeFilterIds.length;
        if (index === -1) {
            // we need to deactivate all groups when activating a favorite
            if (filter.type === 'favorite') {
                this.query.forEach(function (groupId) {
                    self.groups[groupId].activeFilterIds = [];
                });
                this.query = [];
            }
            group.activeFilterIds.push(filterId);
            // if initiaLength is 0, the group was not active.
            if (filter.type === 'favorite' || initiaLength === 0) {
                this.query.push(group.id);
            }
        } else {
            group.activeFilterIds.splice(index, 1);
            // if initiaLength is 1, the group is now inactive.
            if (initiaLength === 1) {
                this.query.splice(this.query.indexOf(group.id), 1);
            }
        }
    },
    // This method should work in batch too
    // TO DO: accept selection of multiple options?
    // for now: activate an option forces the deactivation of the others
    // optionId optional: the method could be used at initialization...
    // --> one falls back on defautlOptionId.
    /**
     * Used to toggle a given filter(Id) that has options with a given option(Id).
     *
     * @private
     * @param {string} filterId
     * @param {string} optionId
     */
    toggleFilterWithOptions: function (filterId, optionId) {
        var filter = this.filters[filterId];
        var group = this.groups[filter.groupId];
        var alreadyActive = group.activeFilterIds.indexOf(filterId) !== -1;
        if (alreadyActive) {
            if (filter.currentOptionId === optionId) {
                this.toggleFilter(filterId);
                filter.currentOptionId = false;
            } else {
                filter.currentOptionId = optionId || filter.defaultOptionId;
            }
        } else {
            this.toggleFilter(filterId);
            filter.currentOptionId = optionId || filter.defaultOptionId;
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _activateDefaultFilters: function () {
        var self = this;
        Object.keys(this.filters).forEach(
            function (filterId) {
                var filter = self.filters[filterId];
                // if we are here, this means there is no favorite with isDefault set to true
                if (filter.isDefault) {
                    if (filter.hasOptions) {
                        self.toggleFilterWithOptions(filter.id);
                    } else {
                        self.toggleFilter(filter.id);
                    }
                }
        });
    },
    _activateDefaultTimeRanges: function (defaultTimeRanges) {
        var self = this;
        if (defaultTimeRanges) {
            var filterId = Object.keys(this.filters).find(function (filterId) {
                var filter = self.filters[filterId];
                return filter.type === 'timeRange' && filter.fieldName === defaultTimeRanges.field;
            });
            if (filterId) {
                this.activateTimeRange(
                    filterId,
                    defaultTimeRanges.range,
                    defaultTimeRanges.comparisonRange
                );
            }
        }
    },
    _addNewFavorite: function (favorite) {
        var id = _.uniqueId('__filter__');
        favorite.id = id;
        favorite.groupId = this._getGroupIdOfType('favorite');
        this.filters[id] = favorite;
        this.toggleFilter(favorite.id);
    },
    // create empty group of a specific type
    _createEmptyGroup: function (type) {
        var id = _.uniqueId('__group__');
        this.groups[id] = {
            id: id,
            type: type,
            activeFilterIds: [],
        };
    },
    // group is a list of (pre) filters
    _createGroupOfFilters: function (group) {
        var self= this;
        var type;
        var groupId = _.uniqueId('__group__');
        group.forEach(function (filter) {
            var id = _.uniqueId('__filter__');
            filter.id = id;
            filter.groupId = groupId;
            type = filter.type;
            self.filters[id] = filter;
        });
        this.groups[groupId] = {
            id: groupId,
            type: type,
            activeFilterIds: [],
        };
    },
    _createGroupOfTimeRanges: function () {
        var self = this;
        var timeRanges = [];
        Object.keys(this.fields).forEach(function (fieldName) {
            var field = self.fields[fieldName];
            var fieldType = field.type;
            if (_.contains(['date', 'datetime'], fieldType) && field.sortable) {
                timeRanges.push({
                    type: 'timeRange',
                    description: field.string,
                    fieldName : fieldName,
                    fieldType: fieldType,
                    timeRangeId: false,
                    comparisonTimeRangeId: false,
                    defaultTimeRangeId: DEFAULT_TIMERANGE,
                    timeRangeOptions: TIME_RANGE_OPTIONS,
                    comparisonTimeRangeOptions: COMPARISON_TIME_RANGE_OPTIONS
                });
            }
        });
        if (timeRanges.length) {
            this._createGroupOfFilters(timeRanges);
        } else {
            // create empty timeRange group
            this._createEmptyGroup('timeRange');
        }
    },
    _generateNewGroupNumber: function () {
        var self = this;
        var groupNumber = 1 + Object.keys(this.filters).reduce(
            function (max, filterId) {
                var filter = self.filters[filterId];
                if (filter.groupNumber) {
                    max = Math.max(filter.groupNumber, max);
                }
                return max;
            },
            1
        );
        return groupNumber;
    },
    // get context (without controller context (this is usefull only for favorite))
    _getQueryContext: function () {
        var self = this;
        var contexts = this.query.reduce(
            function (acc, groupId) {
                var group = self.groups[groupId];
                acc = acc.concat(self._getGroupContexts(group));
                return acc;
            },
            []
        );
        return _.compact(contexts);
    },
    _getDomain: function () {
        var self = this;
        var domains = this.query.map(function (groupId) {
            var group = self.groups[groupId];
            return self._getGroupDomain(group);
        });
        return pyUtils.assembleDomains(domains, 'AND');
    },
    _getFilterContext: function (filter) {
        var context;
        if (filter.type === 'favorite') {
            context = filter.context;
        }
        return context;
    },
    _getFilterDomain: function (filter) {
        var domain;
        if (filter.type === 'filter') {
            domain = filter.domain;
            if (filter.domain === undefined) {
                domain = Domain.prototype.constructDomain(
                    filter.fieldName,
                    filter.currentOptionId,
                    filter.fieldType
                );
            }
        }
        if (filter.type === 'favorite') {
            domain = filter.domain;
        }
        if (filter.type === 'field') {
            domain = filter.domain;
        }
        return domain;
    },
    // should send back a list
    _getFilterGroupBys: function (filter) {
        var groupBys;
        if (filter.type === 'groupBy') {
            var groupBy = filter.fieldName;
            if (filter.currentOptionId) {
                groupBy = groupBy + ':' + filter.currentOptionId;
            }
            groupBys = [groupBy];
        }
        if (filter.type === 'favorite') {
            groupBys = filter.groupBys;
        }
        return groupBys;
    },

    _getGroupBys: function () {
        var self = this;
        var groupBys = this.query.reduce(
            function (acc, groupId) {
                var group = self.groups[groupId];
                return acc.concat(self._getGroupGroupbys(group));
            },
            []
        );
        return groupBys;
    },
    _getGroupContexts: function (group) {
        var self = this;
        var contexts = group.activeFilterIds.map(function (filterId) {
            var filter = self.filters[filterId];
            return self._getFilterContext(filter);
        });
        return _.compact(contexts);
    },
    _getGroupDomain: function (group) {
        var self = this;
        var domains = group.activeFilterIds.map(function (filterId) {
            var filter = self.filters[filterId];
            return self._getFilterDomain(filter);
        });
        return pyUtils.assembleDomains(_.compact(domains), 'OR');
    },

    _getGroupGroupbys: function (group) {
        var self = this;
        var groupBys = group.activeFilterIds.reduce(
            function (acc, filterId) {
                var filter = self.filters[filterId];
                acc = acc.concat(self._getFilterGroupBys(filter));
                return acc;
            },
            []
        );
        return _.compact(groupBys);
    },
    _getGroupIdOfType: function (type) {
        var self = this;
        return Object.keys(this.groups).find(function (groupId) {
            var group = self.groups[groupId];
            return group.type === type;
        });
    },
    _getTimeRangeMenuData: function (evaluation) {
        var context = {};

        var groupOfTimeRanges = this.groups[this._getGroupIdOfType('timeRange')];
        if (groupOfTimeRanges.activeFilterIds.length) {
            var filter = this.filters[groupOfTimeRanges.activeFilterIds[0]];

            var comparisonTimeRange = "[]";
            var comparisonTimeRangeDescription;

            var timeRange = Domain.prototype.constructDomain(
                    filter.fieldName,
                    filter.timeRangeId,
                    filter.fieldType
                );
            var timeRangeDescription = filter.timeRangeOptions.find(function (option) {
                return option.optionId === filter.timeRangeId;
            }).description.toString();
            if (filter.comparisonTimeRangeId) {
                comparisonTimeRange = Domain.prototype.constructDomain(
                    filter.fieldName,
                    filter.timeRangeId,
                    filter.fieldType,
                    null,
                    filter.comparisonTimeRangeId
                );
                comparisonTimeRangeDescription = filter.comparisonTimeRangeOptions.find(function (comparisonOption) {
                    return comparisonOption.optionId === filter.comparisonTimeRangeId;
                }).description.toString();
            }
            if (evaluation) {
                timeRange = Domain.prototype.stringToArray(timeRange);
                comparisonTimeRange = Domain.prototype.stringToArray(comparisonTimeRange);
            }
            context = {
                timeRangeMenuData: {
                    timeRange: timeRange,
                    timeRangeDescription: timeRangeDescription,
                    comparisonTimeRange: comparisonTimeRange,
                    comparisonTimeRangeDescription: comparisonTimeRangeDescription,
                }
            };
        }
        return context;

    },
    _loadFavorites: function () {
        var self = this;
        var def = this.loadFilters(this.modelName,this.actionId).then(function (favorites) {
            if (favorites.length) {
                favorites = favorites.map(function (favorite) {
                    var userId = favorite.user_id ? favorite.user_id[0] : false;
                    var groupNumber = userId ? 1 : 2;
                    var context = pyUtils.eval('context', favorite.context, session.user_context);
                    var groupBys = [];
                    if (context.group_by) {
                        groupBys = context.group_by;
                        delete context.group_by;
                    }
                    return {
                        type: 'favorite',
                        description: favorite.name,
                        isRemovable: true,
                        groupNumber: groupNumber,
                        isDefault: favorite.is_default,
                        domain: favorite.domain,
                        groupBys: groupBys,
                        // we want to keep strings as long as possible
                        context: favorite.context,
                        sort: favorite.sort,
                        userId: userId,
                        serverSideId: favorite.id,
                    };
                });
                self._createGroupOfFilters(favorites);
                var defaultFavoriteId = Object.keys(self.filters).find(function (filterId) {
                    var filter = self.filters[filterId];
                    return filter.type === 'favorite' && filter.isDefault;
                });
                if (defaultFavoriteId) {
                    self.toggleFilter(defaultFavoriteId);
                }
            } else {
                self._createEmptyGroup('favorite');
            }
        });
        return def;
    },
    /**
     * Load search defaults and set the `domain` key on filter (of type `field`).
     * Some search defaults need to fetch data (like m2o for example) so this
     * is asynchronous.
     *
     * @private
     * @returns {Deferred[]}
     */
    _loadSearchDefaults: function () {
        var self = this;
        var defs = [];
        _.each(this.filters, function (filter) {
            if (filter.type === 'field' && filter.isDefault) {
                var def;
                var field = self.fields[filter.attrs.name];
                var value = filter.defaultValue;
                if (field.type === 'many2one') {
                    if (value instanceof Array) {
                        // M2O search fields do not currently handle multiple default values
                        // there are many cases of {search_default_$m2ofield: [id]}, need
                        // to handle this as if it were a single value.
                        value = value[0];
                    }
                    def = self._rpc({
                        model: field.relation,
                        method: 'name_get',
                        args: [value],
                        context: self.initialContext,
                    }).then(function (result) {
                        var autocompleteValue = {
                            label: result[0][1],
                            value: value,
                        };
                        filter.autoCompleteValues.push(autocompleteValue);
                        filter.domain = self._setFilterDomain(filter);
                    });
                } else {
                    var autocompleteValue;
                    if (field.type === 'selection') {
                        var match = _.find(this.attrs.selection, function (sel) {
                            return sel[0] === value;
                        });
                        autocompleteValue = {
                            label: match[1],
                            value: match[0],
                        };
                    } else {
                        autocompleteValue = {
                            label: String(value),
                            value: value,
                        };
                    }
                    filter.autoCompleteValues.push(autocompleteValue);
                    filter.domain = self._setFilterDomain(filter);
                }
                if (def) {
                    defs.push(def);
                }
            }
        });
        return defs;
    },
    /**
     * Processes the search data sent by the search view.
     *
     * @private
     * @param {Object} searchData
     * @param {Object} [searchData.contexts=[]]
     * @param {Object} [searchData.domains=[]]
     * @param {Object} [searchData.groupbys=[]]
     * @returns {Object} an object with keys 'context', 'domain', 'groupBy'
     */
    _processSearchData: function (searchData) {
        var context = searchData.context;
        var domain = searchData.domain;
        var groupBys = searchData.groupBys;
        var action_context = this.initialContext;
        var results = pyUtils.eval_domains_and_contexts({
            domains: [this.initialDomain].concat([domain] || []),
            contexts: [action_context].concat(context || []),
            eval_context: session.user_context,
        });
        var groupBy = groupBys.length ?
                        groupBys :
                        (this.initialContext.group_by || []);
        groupBy = (typeof groupBy === 'string') ? [groupBy] : groupBy;

        if (results.error) {
            throw new Error(_.str.sprintf(_t("Failed to evaluate search criterions")+": \n%s",
                            JSON.stringify(results.error)));
        }

        context = _.omit(results.context, 'time_ranges');

        return {
            context: context,
            domain: results.domain,
            groupBy: groupBy,
        };
    },
    // save favorites should call this method. Here no evaluation of domains,...
    _saveQuery: function (favorite) {
        var self = this;
        var userContext = session.user_context;
        var controllerContext;
        this.trigger_up('get_controller_context', {
            callback: function (context) {
                controllerContext = context;
            },
        });
         // var ctx = results.context;
        // _(_.keys(session.user_context)).each(function (key) {
        //     delete ctx[key];
        // });
        var queryContext = this._getQueryContext();
        // TO DO: find a way to compose context as string without evaluate them (like for domains)
        // Or we could encode in favorite the timeRange menu data as fieldName, timeRangeId,...
        // or better in a separated key.
        var timeRangeMenuInfo = this._getTimeRangeMenuData(false);
        var context = pyUtils.eval(
            'contexts',
            [userContext, controllerContext, timeRangeMenuInfo].concat(queryContext)
        );
        context = _.omit(context, Object.keys(userContext));
        var groupBys = this._getGroupBys();
        if (groupBys.length) {
            context.group_by = groupBys;
        }
        // we need to remove keys in session.userContext from context.
        var domain = this._getDomain();
        var userId = favorite.isShared ? false : session.uid;
        var irFilter = {
            name: favorite.description,
            context: context,
            domain: domain,
            is_default: favorite.isDefault,
            user_id: userId,
            model_id: this.modelName,
            action_id: this.actionId,
        };
        // we don't want the groupBys to be located in the context in search view
        return this.createFilter(irFilter).then(function (serverSideId) {
            delete context.group_by;
            favorite.isRemovable = true;
            favorite.groupNumber = userId ? 1 : 2;
            favorite.context = context;
            favorite.groupBys = groupBys;
            favorite.domain = domain;
            favorite.sort = [];
            // not sure keys are usefull
            favorite.userId = userId;
            favorite.serverSideId = serverSideId;
            self._addNewFavorite(favorite);
        });
    },
    _setFilterDomain: function (filter) {
        var domain = "";
        var field = this.fields[filter.attrs.name];
        // TODO: should not do that, the domain logic should be put somewhere else
        var Obj = core.search_widgets_registry.getAny([filter.attrs.widget, field.type]);
        if (Obj) {
            var obj = new (Obj) (this, filter, field, this.initialContext);
            domain = obj.getDomain(filter.autoCompleteValues);
        }
        return domain;
    },
});

return ControlPanelModel;

});
