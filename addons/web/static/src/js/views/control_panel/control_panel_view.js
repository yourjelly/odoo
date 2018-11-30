odoo.define('web.ControlPanelView', function (require) {
"use strict";

var ControlPanelController = require('web.ControlPanelController');
var ControlPanelModel = require('web.ControlPanelModel');
var ControlPanelRenderer = require('web.ControlPanelRenderer');
var mvc = require('web.mvc');
var pyUtils = require('web.py_utils');
var controlPanelViewParameters = require('web.controlPanelViewParameters');
var viewUtils = require('web.viewUtils');

var DEFAULT_INTERVAL = controlPanelViewParameters.DEFAULT_INTERVAL;
var DEFAULT_PERIOD = controlPanelViewParameters.DEFAULT_PERIOD;
var INTERVAL_OPTIONS = controlPanelViewParameters.INTERVAL_OPTIONS;
var PERIOD_OPTIONS = controlPanelViewParameters.PERIOD_OPTIONS;

var Factory = mvc.Factory;

var ControlPanelView = Factory.extend({
    config: _.extend({}, Factory.prototype.config, {
        Controller: ControlPanelController,
        Model: ControlPanelModel,
        Renderer: ControlPanelRenderer,
    }),
    viewType: 'controlpanel',

    /**
     * @override
     * @param {Object} [params]
     * @param {Object} [params.viewInfo] a controlpanel (or search) fieldsview
     * @param {string} [params.viewInfo.arch]
     * @param {string} [params.context={}]
     * @param {boolean} [params.context.no_breadcrumbs=false] if set to true,
     *   breadcrumbs won't be rendered
     * @param {string} [params.domain=[]]
     * @param {string} [params.template] the QWeb template to render
     * @param {string} [params.withBreadcrumbs=true] if set to false,
     *   breadcrumbs won't be rendered
     * @param {string} [params.withSearchBar=true] if set to false, no default
     *   search bar will be rendered
     */
    init: function (params) {
        var self = this;
        this._super();
        params = params || {};
        var viewInfo = params.viewInfo || {arch: '<controlpanel/>', fields: {}};
        var context = _.extend({}, params.context);

        this.searchDefaults = {};
        Object.keys(context).forEach(function (key) {
            var match = /^search_default_(.*)$/.exec(key);
            if (match) {
                self.searchDefaults[match[1]] = context[key];
                delete context[key];
            }
        });

        this.arch = viewUtils.parseArch(viewInfo.arch);
        this.fields = viewInfo.fields;

        this.controllerParams.modelName = params.modelName;

        this.rendererParams.context = context;

        this.modelParams.context = context;
        this.modelParams.domain = params.domain || [];

        this.rendererParams.template = params.template;
        this.rendererParams.actionInfo = {
            actionId: params.actionId,
            actionDomain: params.domain,
            actionContext: params.context,
            actionType: params.actionType,
            actionName: params.actionName,
            modelName: params.modelName
        };
        this.rendererParams.withBreadcrumbs = !context.no_breadcrumbs && // could we get rid of this ?
                                              params.withBreadcrumbs !== false;
        this.rendererParams.breadcrumbs = params.breadcrumbs;
        this.rendererParams.withSearchBar = 'withSearchBar' in params ? params.withSearchBar : true;
        this.rendererParams.searchMenuTypes = params.searchMenuTypes || ['filter', 'groupBy', 'favorite'];

        this.loadParams.withSearchBar = 'withSearchBar' in params ? params.withSearchBar : true;
        this.loadParams.searchMenuTypes = params.searchMenuTypes || ['filter', 'groupBy', 'favorite'];
        this.loadParams.actionId = params.actionId;
        this.loadParams.fields = this.fields;
        this.loadParams.modelName = params.modelName;
        if (this.loadParams.withSearchBar) {
            if (params.currentConfiguration) {
                this.loadParams.initialConfiguration = params.currentConfiguration;
            } else {
                // groups are determined in _parseSearchArch
                this.loadParams.groups = [];
                this.loadParams.timeRanges = context.time_ranges;
                if (this.arch.tag === 'controlpanel') {
                    this._parseControlPanelArch();
                } else {
                    this._parseSearchArch();
                }
            }
        }

        PERIOD_OPTIONS = PERIOD_OPTIONS.map(function (option) {
            return _.extend(option, {description: option.description.toString()});
        });
        INTERVAL_OPTIONS = INTERVAL_OPTIONS.map(function (option) {
            return _.extend(option, {description: option.description.toString()});
        });

        // TODO: use this where necessary
        // var disableCustomFilters = context.search_disable_custom_filters;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} child parsed arch node
     * @returns {Object}
     */
    _evalArchChild: function (child) {
        if (child.attrs.context) {
            try {
                var context = pyUtils.eval('context', child.attrs.context);
                if (context.group_by) {
                    // let us extract basic data since we just evaluated context
                    // and use a correct tag!
                    child.tag = 'groupBy';
                    child.attrs.fieldName = context.group_by.split(':')[0];
                    child.attrs.defaultInterval = context.group_by.split(':')[1];
                }
            } catch (e) {}
        }
        return child;
    },
    /**
     * @private
     * @param {Object} filter
     * @param {Object} attrs
     */
    _extractAttributes: function (filter, attrs) {
        filter.isDefault = this.searchDefaults[attrs.name] ? true : false;
        filter.description = attrs.string ||
                                attrs.help ||
                                attrs.name ||
                                attrs.domain ||
                                'Ω';
        if (filter.type === 'filter') {
            filter.domain = attrs.domain;
            if (attrs.date) {
                filter.fieldName = attrs.date;
                filter.fieldType = this.fields[attrs.date].type;
                // we should be able to declare list of options per date filter
                // (request of POs) (same remark for groupbys)
                filter.hasOptions = true;
                filter.options = PERIOD_OPTIONS;
                filter.defaultOptionId = attrs.default_period ||
                                            DEFAULT_PERIOD;
                filter.currentOptionId = false;
            }
        } else if (filter.type === 'groupBy') {
            filter.fieldName = attrs.fieldName;
            filter.fieldType = this.fields[attrs.fieldName].type;
            if (_.contains(['date', 'datetime'], filter.fieldType)) {
                filter.hasOptions = true;
                filter.options = INTERVAL_OPTIONS;
                filter.defaultOptionId = attrs.defaultInterval ||
                                            DEFAULT_INTERVAL;
                filter.currentOptionId = false;
            }
        } else if (filter.type === 'field') {
            var field = this.fields[attrs.name];
            filter.attrs = attrs;
            filter.autoCompleteValues = [];
            if (filter.isDefault) {
                // on field, default can be used with a value
                filter.defaultValue = this.searchDefaults[filter.attrs.name];
            }
            if (!attrs.string) {
                attrs.string = field.string;
            }
        }
    },
    /**
     * Executed when the given arch has root node <controlpanel>.
     *
     * @private
     */
    _parseControlPanelArch: function () {
        var controls = [];
        this.arch.children.forEach(function (node) {
            if (node.tag === 'controls') {
                node.children.forEach(function (control) {
                    controls.push(control);
                });
            }
        });
        this.rendererParams.controls = controls;
    },
    /**
     * Executed when the given arch has root node <search>, for backward
     * compatibility with former 'search' view.
     *
     * @private
     */
    _parseSearchArch: function () {
        var self = this;
        var preFilters = _.flatten(this.arch.children.map(function (child) {
            return child.tag !== 'group' ?
                    self._evalArchChild(child) :
                    child.children.map(self._evalArchChild);
        }));
        preFilters.push({tag: 'separator'});

        var filter;
        var currentTag;
        var currentGroup = [];
        var groupOfGroupBys = [];
        var groupNumber = 1;

        _.each(preFilters, function (preFilter) {
            if (preFilter.tag !== currentTag || _.contains(['separator', 'field'], preFilter.tag)) {
                if (currentGroup.length) {
                    if (currentTag === 'groupBy') {
                        groupOfGroupBys = groupOfGroupBys.concat(currentGroup);
                    } else {
                        self.loadParams.groups.push(currentGroup);
                    }
                }
                currentTag = preFilter.tag;
                currentGroup = [];
                groupNumber++;
            }
            if (preFilter.tag !== 'separator') {
                filter = {
                    type: preFilter.tag,
                    // we need to codify here what we want to keep from attrs
                    // and how, for now I put everything.
                    // In some sence, some filter are active (totally determined, given)
                    // and others are passive (require input(s) to become determined)
                    // What is the right place to process the attrs?
                };
                if (filter.type === 'filter' || filter.type === 'groupBy') {
                    filter.groupNumber = groupNumber;
                }
                self._extractAttributes(filter, preFilter.attrs);
                currentGroup.push(filter);
            }
        });
        if (groupOfGroupBys.length) {
            this.loadParams.groups.push(groupOfGroupBys);
        }
    },
});

return ControlPanelView;

});
