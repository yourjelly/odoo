odoo.define('web.AbstractView', function (require) {
"use strict";

/**
 * This is the base class inherited by all (JS) views. Odoo JS views are the
 * widgets used to display information in the main area of the web client
 * (note: the search view is not a "JS view" in that sense).
 *
 * The abstract view role is to take a set of fields, an arch (the xml
 * describing the view in db), and some params, and then, to create a
 * controller, a renderer and a model.  This is the classical MVC pattern, but
 * the word 'view' has historical significance in Odoo code, so we replaced the
 * V in MVC by the 'renderer' word.
 *
 * JS views are supposed to be used like this:
 * 1. instantiate a view with some arch, fields and params
 * 2. call the getController method on the view instance. This returns a
 *    controller (with a model and a renderer as sub widgets)
 * 3. append the controller somewhere
 *
 * Note that once a controller has been instantiated, the view class is no
 * longer useful (unless you want to create another controller), and will be
 * in most case discarded.
 */

var AbstractModel = require('web.AbstractModel');
var AbstractRenderer = require('web.AbstractRenderer');
var AbstractController = require('web.AbstractController');
var ControlPanelView = require('web.ControlPanelView');
var mvc = require('web.mvc');
var viewUtils = require('web.viewUtils');

var Factory = mvc.Factory;

var AbstractView = Factory.extend({
    // name displayed in view switchers
    display_name: '',
    // indicates whether or not the view is mobile-friendly
    mobile_friendly: false,
    // icon is the font-awesome icon to display in the view switcher
    icon: 'fa-question',
    // multi_record is used to distinguish views displaying a single record
    // (e.g. FormView) from those that display several records (e.g. ListView)
    multi_record: true,
    // viewType is the type of the view, like 'form', 'kanban', 'list'...
    viewType: undefined,
    // determines if a search bar is available
    withSearchBar: true,
    // determines the search menus available and their orders
    searchMenuTypes: ['filter', 'groupBy', 'favorite'],
    config: _.extend({}, Factory.prototype.config, {
        Model: AbstractModel,
        Renderer: AbstractRenderer,
        Controller: AbstractController,
    }),
    withControlPanel: true,

    /**
     * The constructor function is supposed to set 3 variables: rendererParams,
     * controllerParams and loadParams.  These values will be used to initialize
     * the model, renderer and controllers.
     *
     * @constructs AbstractView
     *
     * @param {Object} viewInfo
     * @param {Object} viewInfo.arch
     * @param {Object} viewInfo.fields
     * @param {Object} viewInfo.fieldsInfo
     * @param {Object} params
     * @param {string} params.modelName The actual model name
     * @param {Object} params.context
     * @param {number} [params.count]
     * @param {string} [params.controllerID]
     * @param {string[]} params.domain
     * @param {string[][]} params.timeRange
     * @param {string[][]} params.comparisonTimeRange
     * @param {string} params.timeRangeDescription
     * @param {string} params.comparisonTimeRangeDescription
     * @param {boolean} params.compare
     * @param {string[]} params.groupBy
     * @param {number} [params.currentId]
     * @param {boolean} params.isEmbedded
     * @param {number[]} [params.ids]
     * @param {boolean} [params.withControlPanel]
     * @param {boolean} [params.action.flags.headless]
     * @param {string} [params.action.display_name]
     * @param {string} [params.action.name]
     * @param {string} [params.action.help]
     * @param {string} [params.action.jsID]
     * @param {boolean} [params.action.views]
     */
    init: function (viewInfo, params) {
        // in general, the fieldsView has to be processed by the View (e.g. the
        // arch is a string that needs to be parsed) ; the only exception is for
        // inline form views inside form views, as they are processed alongside
        // the main view, but they are opened in a FormViewDialog which
        // instantiates another FormView (unlike kanban or list subviews for
        // which only a Renderer is instantiated)
        if (typeof viewInfo.arch === 'string') {
            this.fieldsView = this._processFieldsView(viewInfo);
        } else {
            this.fieldsView = viewInfo;
        }
        this.fields = this.fieldsView.viewFields;
        this.arch = this.fieldsView.arch;
        // the boolean parameter 'isEmbedded' determines if the view should be considered
        // as a subview. For now this is only used by the graph controller that appends a
        // 'Group By' button beside the 'Measures' button when the graph view is embedded.
        var isEmbedded = params.isEmbedded || false;
        this.rendererParams = {
            arch: this.arch,
            isEmbedded: isEmbedded,
            noContentHelp: params.action && params.action.help,
        };
        this.controllerParams = {
            modelName: params.modelName,
            activeActions: {
                edit: this.arch.attrs.edit ? JSON.parse(this.arch.attrs.edit) : true,
                create: this.arch.attrs.create ? JSON.parse(this.arch.attrs.create) : true,
                delete: this.arch.attrs.delete ? JSON.parse(this.arch.attrs.delete) : true,
                duplicate: this.arch.attrs.duplicate ? JSON.parse(this.arch.attrs.duplicate) : true,
            },
            isEmbedded: isEmbedded,
            controllerID: params.controllerID,
            bannerRoute: this.arch.attrs.banner_route,
        };

        // AAB: these params won't be necessary as soon as the ControlPanel will
        // be instantiated by the View
        this.controllerParams.displayName = params.action && (params.action.display_name || params.action.name);
        this.controllerParams.isMultiRecord = this.multi_record;
        this.controllerParams.actionViews = params.action ? params.action.views : [];
        this.controllerParams.viewType = this.viewType;

        var action = params.action || {};
        if ('withControlPanel' in params) {
            this.withControlPanel = params.withControlPanel;
        } else if (action.flags) {
            this.withControlPanel = !action.flags.headless;
        }

        this.loadParams = {
            context: params.context,
            count: params.count || ((this.controllerParams.ids !== undefined) &&
                   this.controllerParams.ids.length) || 0,
            modelName: params.modelName,
            res_id: params.currentId,
            res_ids: params.ids,
        };
        // default_order is like:
        //   'name,id desc'
        // but we need it like:
        //   [{name: 'id', asc: false}, {name: 'name', asc: true}]
        var defaultOrder = this.arch.attrs.default_order;
        if (defaultOrder) {
            this.loadParams.orderedBy = _.map(defaultOrder.split(','), function (order) {
                order = order.trim().split(' ');
                return {name: order[0], asc: order[1] !== 'desc'};
            });
        }
        if (action.flags && action.flags.hasSearchView === false) {
            this.withSearchBar = false;
            this.searchMenuTypes = [];
        }
        this.controlPanelParams = {
            // rename
            actionId: action.id || false,
            actionName: action.name,
            actionType: action.type,
            breadcrumbs: params.breadcrumbs,
            context: params.context,
            currentConfiguration: params.currentControlPanelConfiguration,
            domain: params.domain,
            modelName: action.res_model,
            searchMenuTypes: this.searchMenuTypes,
            viewInfo: action.controlPanelFieldsView,
            withBreadcrumbs: params.withBreadcrumbs,
            withSearchBar: this.withSearchBar,
        };

        this.userContext = params.userContext;

        if (params.searchQuery) {
            this._updateMVCParams(params.searchQuery);
        }
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     */
    getController: function (parent) {
        var self = this;
        var def;
        if (this.withControlPanel) {
            def = this._createControlPanel(parent);
        }
        var _super = this._super.bind(this);
        return $.when(def).then(function (controlPanel) {
            if (controlPanel) {
                var searchQuery = controlPanel.getSearchState();
                self._updateMVCParams(searchQuery);
            }
            // get the parent of the model if it already exists, as _super will
            // set the new controller as parent, which we don't want
            var modelParent = self.model && self.model.getParent();
            return _super(parent).done(function (controller) {
                if (controlPanel) {
                    controlPanel.setParent(controller);
                }
                if (modelParent) {
                    // if we already add a model, restore its parent
                    self.model.setParent(modelParent);
                }
            });

        });
    },
    /**
     * Ensures that only one instance of AbstractModel is created
     *
     * @override
     */
    getModel: function () {
        if (!this.model) {
            this.model = this._super.apply(this, arguments);
        }
        return this.model;
    },
    /**
     * This is useful to customize the actual class to use before calling
     * createView.
     *
     * @param {Controller} Controller
     */
    setController: function (Controller) {
        this.Controller = Controller;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _createControlPanel: function (parent) {
        var self = this;
        var controlPanelView = new ControlPanelView(this.controlPanelParams);
        return controlPanelView.getController(parent).then(function (controlPanel) {
            self.controllerParams.controlPanel = controlPanel;
            return controlPanel.appendTo(document.createDocumentFragment()).then(function () {
                return controlPanel;
            });
        });
    },
    /**
     * Processes a fieldsView. In particular, parses its arch.
     *
     * @private
     * @param {Object} fieldsView
     * @param {string} fieldsView.arch
     * @returns {Object} the processed fieldsView
     */
    _processFieldsView: function (fieldsView) {
        var fv = _.extend({}, fieldsView);
        fv.arch = viewUtils.parseArch(fv.arch);
        fv.viewFields = _.defaults({}, fv.viewFields, fv.fields);
        return fv;
    },
    _updateMVCParams: function (searchQuery) {
        var timeRangeMenuData = searchQuery.context.timeRangeMenuData;
        var timeRange = [];
        var comparisonTimeRange = [];
        var compare = false;
        var timeRangeDescription = "";
        var comparisonTimeRangeDescription = "";
        if (timeRangeMenuData) {
            _.extend(this.loadParams, timeRangeMenuData);
            timeRange = timeRangeMenuData.timeRange;
            comparisonTimeRange = timeRangeMenuData.comparisonTimeRange;
            compare = comparisonTimeRange.length > 0;
            timeRangeDescription = timeRangeMenuData.timeRangeDescription;
            comparisonTimeRangeDescription = timeRangeMenuData.comparisonTimeRangeDescription;
        }
        _.extend(this.loadParams, {
            context: searchQuery.context,
            domain: searchQuery.domain,
            timeRange: timeRange,
            timeRangeDescription: timeRangeDescription,
            comparisonTimeRange: comparisonTimeRange,
            comparisonTimeRangeDescription: comparisonTimeRangeDescription,
            compare: compare,
            groupedBy: searchQuery.groupBy,
        });
        this.rendererParams.timeRangeDescription = timeRangeDescription;
        this.rendererParams.comparisonTimeRangeDescription = comparisonTimeRangeDescription;
    },
});

return AbstractView;

});
