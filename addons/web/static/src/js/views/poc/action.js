odoo.define("poc.Action", function (require) {
    "use strict";

    const AbstractModel = require("web.AbstractModel");
    const ActionModel = require("web/static/src/js/views/action_model.js");
    const { DropPrevious } = require("web.concurrency");
    const ControlPanel = require("web.ControlPanel");
    const SearchPanel = require("web/static/src/js/views/search_panel.js");
    const View = require("web.AbstractRendererOwl");
    const parseArch = require("poc.arch_parser");

    const {
        Component,
        core: {
            EventBus,
        },
        hooks: {
            useState,
            useSubEnv,
        },
        tags: {
            xml,
        },
    } = owl;

    class ModelAdapter extends EventBus {
        constructor(env, Model, params) {
            super();
            this.env = env;
            this.model = new Model(this, params);

            return new Proxy(this, {
                get(target, key) {
                    const value = target.model[key];
                    if (typeof value === "function") {
                        return value.bind(target.model);
                    }
                    return value;
                },
            });
        }

        _trigger_up(ev) {
            const evType = ev.name;
            const payload = ev.data;

            if (evType === 'call_service') {
                let args = payload.args || [];
                if (payload.service === 'ajax' && payload.method === 'rpc') {
                    // ajax service uses an extra 'target' argument for rpc
                    args = args.concat(ev.target);
                }
                const service = this.env.services[payload.service];
                const result = service[payload.method].apply(service, args);
                payload.callback(result);
            } else if (evType === 'get_session') {
                if (payload.callback) {
                    payload.callback(this.env.session);
                }
            } else if (evType === 'load_views') {
                const params = {
                    model: payload.modelName,
                    context: payload.context,
                    views_descr: payload.views,
                };
                this.env.dataManager
                    .load_views(params, payload.options || {})
                    .then(payload.on_success);
            } else if (evType === 'load_filters') {
                return this.env.dataManager
                    .load_filters(payload)
                    .then(payload.on_success);
            } else {
                payload.__targetWidget = ev.target;
                this.trigger(evType.replace(/_/g, '-'), payload);
            }
        }
    }

    class Action extends Component {
        get viewType() {
            return this.constructor.viewType;
        }
        get action() {
            return this.props.viewOptions.action || {};
        }
        get modelName() {
            return this.action.res_model;
        }
        get controllerId() {
            return this.props.viewOptions.controllerID;
        }
        get actionViews() {
            return this.action.views || [];
        }
        get displayName() {
            return this.action.display_name || this.action.name;
        }
        get isEmbedded() {
            return this.props.viewOptions.isEmbedded || false;
        }
        get fields() {
            return this.props.fieldsView.viewFields;
        }

        get userContext() {
            return this.props.viewOptions.userContext || {};
        }
        get context() {
            return this.action.context || {};
        }
        get withBreadcrumbs() {
            return this.context.no_breadcrumbs || false;
        }
        get withControlPanel() {
            return this.constructor.withControlPanel;
        }
        get withSearchBar() {
            return this.action.target === "inline" ? false : this.constructor.withSearchBar;
        }
        get withSearchPanel() {
            return this.constructor.withSearchPanel &&
                this.constructor.multiRecord &&
                !('search_panel' in this.context && !this.props.viewOptions.search_panel) &&
                !!this.archInfo[this.constructor.components.SearchPanel.modelExtension];
        }
        get noContentHelp() {
            return this.action.help;
        }
        get searchMenuTypes() {
            return this.action.target === "inline" ? [] : this.constructor.searchMenuTypes;
        }
        get searchQuery() {
            return this.props.viewOptions.searchQuery;
        }

        constructor(parent, { fieldsView, viewOptions }) {
            super(...arguments);

            console.log(fieldsView, viewOptions);

            this._dropPrevious = new DropPrevious();

            this.state = useState({});
            useSubEnv({
                viewModel: null,
            });

            const archs = {
                // search
                // [this.viewType]
                // [embeddedViewType]
            };
            if (typeof fieldsView.arch === "string") {
                archs[this.viewType] = fieldsView.arch;
            }
            if (this.action.controlPanelFieldsView) {
                archs.search = this.action.controlPanelFieldsView.arch;
            }
            this.archInfo = ActionModel.extractArchInfo(archs, this.viewType);
            this.arch = this.archInfo[this.viewType] || fieldsView.arch;

            this.activeActions = {
                edit: this.arch.get("edit").boolean,
                create: this.arch.get("create").boolean,
                delete: this.arch.get("delete").boolean,
                duplicate: this.arch.get("duplicate").boolean,
            };
            this.bannerRoute = this.arch.get("banner_route").raw;

            const controllerState = viewOptions.controllerState || {};
            const currentId = controllerState.currentId || viewOptions.currentId;

            const useSampleModel = "useSampleModel" in viewOptions ?
                viewOptions.useSampleModel : this.arch.get("sample").boolean;

            this.config = {
                model: {
                    fields: this.fields,
                    modelName: this.modelName,
                    useSampleModel,
                },
                load: {
                    context: this.context,
                    count: viewOptions.count || (this.ids !== undefined && this.ids.length) || 0,
                    domain: viewOptions.domain || [],
                    modelName: this.modelName,
                    res_id: currentId,
                    res_ids: controllerState.resIds || viewOptions.ids || (currentId ? [currentId] : undefined),
                },
                view: {
                    arch: this.arch,
                    isEmbedded: this.isEmbedded,
                    noContentHelp: this.noContentHelp,
                },
                // controlPanel: {},
                // searchPanel: {},
            };

            if (useSampleModel) {
                this.config.model.SampleModel = this.constructor.components.Model;
            }
            const defaultOrder = this.arch.get("default_order");
            if (defaultOrder.exists) {
                this.config.load.orderedBy = defaultOrder.list(",").map((order) => {
                    order = order.trim().split(' ');
                    return {name: order[0], asc: order[1] !== 'desc'};
                });
            }
            if (this.searchQuery) {
                this._updateMVCParams(this.searchQuery);
            }

            this.buildConfigs();

            const searchModelParams = Object.assign({}, this.props.viewOptions, { action: this.action });
            if (this.withControlPanel || this.withSearchPanel) {
                const { fields, favoriteFilters } = this.action.controlPanelFieldsView || {};
                const controlPanelInfo = this.archInfo[this.constructor.components.ControlPanel.modelExtension];
                const searchPanelInfo = this.archInfo[this.constructor.components.SearchPanel.modelExtension];
                Object.assign(searchModelParams, {
                    fields,
                    favoriteFilters,
                    controlPanelInfo,
                    searchPanelInfo,
                });
            }
            const searchModel = this._createSearchModel(searchModelParams);
            this.searchModel = searchModel;
            if (this.config.controlPanel) {
                this.config.controlPanel.searchModel = searchModel;
            }
            if (this.config.searchPanel) {
                this.config.searchPanel.searchModel = searchModel;
            }

            Object.assign(this.config.controlPanel, {
                title: this.getTitle(),
            });

            this.model = new ModelAdapter(this.env, this.constructor.components.Model, this.config.model);
            this.env.viewModel = this.model;
        }

        async willStart() {
            await this.searchModel.load();
            this._updateMVCParams(this.searchModel.get("query"));

            const { state, handle } = await this._loadData();
            Object.assign(this.state, state);
            this.initialState = this.model.get(handle);
            this.handle = handle;

            await super.willStart();
        }
        mounted() {
            super.mounted(...arguments);

            this.searchModel.on('search', this, this._onSearch);
            this._pushState();
        }

        get viewProps() {
            return Object.assign({}, this.config.view, this.state);
        }

        async update(params, options={}) {
            const shouldReload = 'reload' in options ? options.reload : true;
            if (shouldReload) {
                this.handle = await this._dropPrevious.add(this.model.reload(this.handle, params));
            }
            const state = this.model.get(this.handle, { withSampleData: true });
            Object.assign(this.state, state);
        }

        buildConfigs() {}

        _updateMVCParams(searchQuery) {
            Object.assign(this.config.load, {
                context: searchQuery.context,
                domain: searchQuery.domain,
                groupedBy: searchQuery.groupBy,
                orderedBy: Array.isArray(searchQuery.orderedBy) && searchQuery.orderedBy.length ?
                                searchQuery.orderedBy :
                                this.config.load.orderedBy
            });
            if (searchQuery.timeRanges) {
                this.config.load.timeRanges = searchQuery.timeRanges;
                this.config.view.timeRanges = searchQuery.timeRanges;
            }
        }
        _createSearchModel(params, extraExtensions) {
            // Search model + common components
            const { fields, favoriteFilters, controlPanelInfo, searchPanelInfo } = params;
            const extensions = Object.assign({}, extraExtensions);
            const importedState = params.controllerState || {};

            // Control panel params
            if (this.withControlPanel) {
                // Control panel (Model)
                const ControlPanelComponent = this.constructor.components.ControlPanel;
                extensions[ControlPanelComponent.modelExtension] = {
                    actionId: params.action.id,
                    // control initialization
                    activateDefaultFavorite: params.activateDefaultFavorite,
                    archNodes: controlPanelInfo.children,
                    dynamicFilters: params.dynamicFilters,
                    favoriteFilters,
                    withSearchBar: params.withSearchBar,
                };
                // Control panel (Component)
                this.config.controlPanel = {
                    action: params.action,
                    breadcrumbs: params.breadcrumbs,
                    fields,
                    searchMenuTypes: this.searchMenuTypes,
                    view: this.fieldsView,
                    views: params.action.views && params.action.views.filter(
                        v => v.multiRecord === this.constructor.multiRecord
                    ),
                    withBreadcrumbs: params.withBreadcrumbs,
                    withSearchBar: params.withSearchBar,
                };
            }
    
            // Search panel params
            if (this.withSearchPanel) {
                // Search panel (Model)
                const SearchPanelComponent = this.constructor.components.SearchPanel;
                extensions[SearchPanelComponent.modelExtension] = {
                    archNodes: searchPanelInfo.children,
                };

                // Search panel (Component)
                const searchPanelProps = {
                    importedState: importedState.searchPanel,
                };
                if (searchPanelInfo.attributes.class) {
                    searchPanelProps.className = searchPanelInfo.attributes.class;
                }
                this.config.searchPanel = searchPanelProps;
            }

            const searchModel = new ActionModel(extensions, {
                env: this.env,
                modelName: this.modelName,
                context: Object.assign({}, this.config.load.context),
                domain: this.config.load.domain,
                importedState: importedState.searchModel,
                searchMenuTypes: this.searchMenuTypes,
                searchQuery: params.searchQuery,
                fields,
            });

            return searchModel;
        }
        async _loadData(options = {}) {
            options.withSampleData = 'withSampleData' in options ? options.withSampleData : true;
            const handle = await this.model.load(this.config.load);
            return { state: this.model.get(handle, options), handle };
        }

        async canBeRemoved() {
            return true;
        }
        exportState() {
            const exported = {
                searchModel: this.searchModel.exportState(),
            };
            if (this.withSearchPanel) {
                // const searchPanel = this._searchPanelWrapper.componentRef.comp;
                // exported.searchPanel = searchPanel.exportState();
            }
            return exported;
        }
        getTitle() {
            return this.displayName || this.arch.get("string").raw;
        }
        getState() {
            return {};
        }
        _pushState() {
            this.trigger('push_state', {
                controllerID: this.controllerId,
                state: this.getState(),
            });
        }
        willRestore() {
            return Promise.resolve();
        }
        reload() {
            return Promise.resolve();
        }
        _onSwitchView(ev) {
            ev.detail.controllerID = this.controllerId;
        }
        _onSearch(searchQuery) {
            this.update(searchQuery);
        }
    }

    Action.components = {
        Model: AbstractModel,
        ControlPanel,
        SearchPanel,
        View,
    };

    Action.defaultProps = {
    };

    Object.assign(Action, {
        // name displayed in view switchers
        displayName: '',
        // indicates whether or not the view is mobile-friendly
        mobileFriendly: false,
        // icon is the font-awesome icon to display in the view switcher
        icon: 'fa-question',
        // multiRecord is used to distinguish views displaying a single record
        // (e.g. FormView) from those that display several records (e.g. ListView)
        multiRecord: true,
        // viewType is the type of the view, like 'form', 'kanban', 'list'...
        viewType: undefined,
        // determines if a search bar is available
        withSearchBar: true,
        // determines the search menus available and their orders
        searchMenuTypes: ['filter', 'groupBy', 'favorite'],
        // determines if a control panel should be instantiated
        withControlPanel: true,
        // determines if a search panel could be instantiated
        withSearchPanel: true,
    });

    Action.template = xml/*xml*/`
        <div class="o_view_controller" t-on-switch-view="_onSwitchView">
            <t t-if="withControlPanel">
                <ControlPanel t-props="config.controlPanel"/>
            </t>
            <View t-props="viewProps"/>
        </div>
    `;

    return Action;
});