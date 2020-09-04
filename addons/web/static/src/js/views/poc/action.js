odoo.define("poc.Action", function (require) {
    "use strict";

    const ActionModel = require("web/static/src/js/views/action_model.js");
    const { DropPrevious } = require("web.concurrency");
    const ControlPanel = require("web.ControlPanel");
    const SearchPanel = require("web/static/src/js/views/search_panel.js");
    const View = require("web.AbstractRendererOwl");
    const ViewController = require("poc.ViewController");

    const {
        Component,
        hooks: {
            useState,
            useSubEnv,
        },
        tags: {
            xml,
        },
    } = owl;

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
        get controlPanelFieldsView() {
            return this.action.controlPanelFieldsView || {};
        }
        get domain() {
            return this.props.viewOptions.domain || [];
        }

        get viewProps() {
            return Object.assign({}, this.configs.view, this.state);
        }

        constructor(parent, { fieldsView, viewOptions }) {
            super(...arguments);

            this._dropPrevious = new DropPrevious();

            this.state = useState({});

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
            if (this.viewType in this.archInfo) {
                this.arch = this.archInfo[this.viewType];
            } else {
                this.arch = this.archInfo[this.viewType] = fieldsView.arch;
            }

            this.activeActions = {
                edit: this.arch.get("edit").boolean,
                create: this.arch.get("create").boolean,
                delete: this.arch.get("delete").boolean,
                duplicate: this.arch.get("duplicate").boolean,
            };
            this.bannerRoute = this.arch.get("banner_route").raw;

            this.configs = {
                model: {},
                view: {},
                controlPanel: {},
                searchPanel: {},

                load: {},
            };

            this.buildConfigs();

            this.model = this._createModel();
            // FIXME: Don't pass searchModel by props, get it from env instead
            if (this.configs.controlPanel) {
                this.configs.controlPanel.searchModel = this.model;
            }
            if (this.configs.searchPanel) {
                this.configs.searchPanel.searchModel = this.model;
            }

            useSubEnv({
                model: this.model,
            });
        }

        async willStart() {
            await this.model.load();
            await this.model.isReady();

            await super.willStart();
        }
        mounted() {
            super.mounted(...arguments);

            this.model.on('search', this, this._onSearch);
            this._pushState();
        }

        async update(params, options={}) {
            return;

            const shouldReload = 'reload' in options ? options.reload : true;
            if (shouldReload) {
                this.handle = await this._dropPrevious.add(this.model.reload(this.handle, params));
            }
            const state = this.model.get(this.handle, { withSampleData: true });
            Object.assign(this.state, state);
        }

        buildConfigs() {
            this.buildLoadConfig();
            this.buildModelConfig();
            this.buildViewConfig();
            if (this.withControlPanel) {
                this.buildControlPanelConfig();
            }
            if (this.withSearchPanel) {
                this.buildSearchPanelConfig();
            }
        }
        buildLoadConfig() {
            const controllerState = this.props.viewOptions.controllerState || {};
            const currentId = controllerState.currentId || this.props.viewOptions.currentId;

            Object.assign(this.configs.model, {
                context: this.context,
                count: this.props.viewOptions.count || 0,
                domain: this.domain,
                modelName: this.modelName,
                res_id: currentId,
                res_ids: controllerState.resIds || this.props.viewOptions.ids || (currentId ? [currentId] : undefined),
            });

            const defaultOrder = this.arch.get("default_order");
            if (defaultOrder.exists) {
                this.configs.load.orderedBy = defaultOrder.list(",").map((order) => {
                    order = order.trim().split(' ');
                    return {name: order[0], asc: order[1] !== 'desc'};
                });
            }
        }
        buildModelConfig() {
            const useSampleModel = "useSampleModel" in this.props.viewOptions ?
                this.props.viewOptions.useSampleModel :
                this.arch.get("sample").boolean;

            Object.assign(this.configs.model, {
                fields: this.fields,
                modelName: this.modelName,
                useSampleModel,
                context: this.context,
            });

            // if (useSampleModel) {
            //     this.configs.model.SampleModel = this.constructor.components.Model;
            // }
        }
        buildViewConfig() {
            Object.assign(this.configs.view, {
                arch: this.arch,
                isEmbedded: this.isEmbedded,
                noContentHelp: this.noContentHelp,
            });
        }
        buildControlPanelConfig() {
            Object.assign(this.configs.controlPanel, {
                action: this.action,
                breadcrumbs: this.props.viewOptions.breadcrumbs,
                fields: this.controlPanelFieldsView.fields,
                searchMenuTypes: this.searchMenuTypes,
                view: this.props.fieldsView,
                views: this.actionViews.filter(
                    v => v.multiRecord === this.constructor.multiRecord
                ),
                withBreadcrumbs: this.withBreadcrumbs,
                withSearchBar: this.withSearchBar,
                title: this.getTitle(),
            });
        }
        buildSearchPanelConfig() {
            const controllerState = this.props.viewOptions.controllerState || {};

            this.configs.searchPanel.importedState = controllerState.importedState.searchPanel;
            if (searchPanelInfo.attributes.class) {
                this.configs.searchPanel.className = searchPanelInfo.attributes.class;
            }
        }

        buildModelExtensions() {
            const extensions = {};

            if (this.withControlPanel) {
                const ControlPanelComponent = this.constructor.components.ControlPanel;
                const controlPanelInfo = this.archInfo[ControlPanelComponent.modelExtension];
                extensions[ControlPanelComponent.modelExtension] = {
                    actionId: this.action.id,
                    activateDefaultFavorite: !this.context.active_id && !this.context.active_ids,
                    archNodes: controlPanelInfo.children,
                    dynamicFilters: this.props.viewOptions.dynamicFilters,
                    favoriteFilters: this.controlPanelFieldsView.favoriteFilters,
                    withSearchBar: this.withSearchBar,
                };
            }

            if (this.withSearchPanel) {
                const SearchPanelComponent = this.constructor.components.SearchPanel;
                const searchPanelInfo = this.archInfo[SearchPanelComponent.modelExtension];
                extensions[SearchPanelComponent.modelExtension] = {
                    archNodes: searchPanelInfo.children,
                };
            }

            extensions[this.viewType] = this.configs.model;

            return extensions;
        }

        _createModel() {
            const controllerState = this.props.viewOptions.controllerState || {};
            const importedState = controllerState.importedState || {};

            return new ActionModel(this.buildModelExtensions(), {
                env: this.env,
                modelName: this.modelName,
                context: Object.assign({}, this.configs.model.context),
                domain: this.domain,
                importedState: importedState.searchModel,
                searchMenuTypes: this.searchMenuTypes,
                searchQuery: this.props.viewOptions.searchQuery,
                fields: this.controlPanelFieldsView.fields,
            });
        }

        async _loadData(options = {}) {
            options.withSampleData = 'withSampleData' in options ? options.withSampleData : true;
            const handle = await this.model.load(this.configs.load);
            return { state: this.model.get(handle, options), handle };
        }
        _pushState() {
            this.trigger('push_state', {
                controllerID: this.controllerId,
                state: this.getState(),
            });
        }

        _onSwitchView(ev) {
            ev.detail.controllerID = this.controllerId;
        }
        _onSearch(searchQuery) {
            this.update(searchQuery);
        }

        // compatibility
        willRestore() {
            return Promise.resolve();
        }
        reload() {
            return Promise.resolve();
        }
        getState() {
            return {};
        }
        async canBeRemoved() {
            return true;
        }
        exportState() {
            const exported = {
                searchModel: this.model.exportState(),
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
    }

    Action.components = {
        ControlPanel,
        SearchPanel,
        View,
        ViewController,
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
                <ControlPanel t-props="configs.controlPanel">
                    <t t-set-slot="buttons">
                        <ViewController />
                    </t>
                </ControlPanel>
            </t>
            <View t-props="viewProps"/>
        </div>
    `;

    return Action;
});