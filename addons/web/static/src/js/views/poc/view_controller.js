odoo.define("poc.ViewController", function (require) {
    "use strict";

    const ActionModel = require("web/static/src/js/views/action_model.js");
    const AbstractModel = require("web.AbstractModel");
    const ControlPanel = require("web.ControlPanel");
    const SearchPanel = require("web/static/src/js/views/search_panel.js");
    const View = require("poc.view");

    const {
        Component,
        core: {
            EventBus,
        },
        hooks: {
            useState,
        },
        tags: {
            xml,
        },
    } = owl;

    class ArchNode {
        constructor(tag, attributes, children) {
            this.tag = tag.toLowerCase();
            this.attributes = attributes;
            this.children = children;
        }

        hasAttribute(name) {
            return this.attributes.hasOwnProperty(name);
        }
        isNull(name) {
            return this.attributes[name] === null ||
                this.attributes[name] === undefined;
        }
        getString(name) {
            return this.attributes[name];
        }
        getBoolean(name) {
            return !this.isNull(name) && (
                this.attributes[name].toLowerCase() === "true" ||
                this.attributes[name] === "1"
            );
        }
        getNumber(name) {
            return !this.isNull(name) ?
                parseFloat(this.attributes[name]) :
                null;
        }
        getJson(name) {
            return !this.isNull(name) ?
                JSON.parse(this.attributes[name]) :
                null;
        }
        getList(name, separator) {
            return !this.isNull(name) ?
                this.attributes[name].split(separator) :
                [];
        }
    }

    function parseArch(arch) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(arch, "text/xml").documentElement;
        const stripWhitespaces = doc.nodeName.toLowerCase() !== 'kanban';

        function xmlToJson(node) {
            switch (node.nodeType) {
                case 9:
                    return xmlToJson(node.documentElement);
                case 3:
                case 4:
                    return (stripWhitespaces && node.data.trim() === '') ? undefined : node.data;
                case 1: {
                    const attributes = Object.fromEntries(
                        Array.from(node.attributes).map(x => [x.name, x.value])
                    );
                    const children = Array.from(node.childNodes)
                        .map(node => xmlToJson(node))
                        .filter(Boolean);
                    return new ArchNode(
                        node.tagName.toLowerCase(),
                        attributes,
                        children
                    );
                }
            }
        }

        return xmlToJson(doc);
    }

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

    class ViewController extends Component {
        constructor(parent, { fieldsView, viewOptions }) {
            super(...arguments);

            this.state = useState({
                rev: 0,
                renderer: {},
                controlPanel: {},
                searchPanel: {},
            });
            if (typeof fieldsView.arch === 'string') {
                this.fieldsView = this._processFieldsView(fieldsView);
            } else {
                this.fieldsView = fieldsView;
            }
            this.arch = this.fieldsView.arch;
            this.fields = this.fieldsView.viewFields;

            const action = viewOptions.action || {};
            const params = Object.assign({}, viewOptions, this._extractParamsFromAction(action));
            this.userContext = params.userContext || {};

            const isEmbedded = params.isEmbedded || false;

            this.rendererParams = {
                arch: this.arch,
                isEmbedded: isEmbedded,
                noContentHelp: params.noContentHelp,
            };

            this.actionViews = params.actionViews;
            this.activeActions = {
                edit: this.arch.getBoolean("edit"),
                create: this.arch.getBoolean("create"),
                delete: this.arch.getBoolean("delete"),
                duplicate: this.arch.getBoolean("duplicate"),
            };
            this.bannerRoute = this.arch.getString("banner_route");
            this.controllerID = params.controllerID;
            this.displayName = params.displayName;
            this.isEmbedded = isEmbedded;
            this.modelName = params.modelName;
            this.viewType = this.constructor.viewType;

            const controllerState = params.controllerState || {};
            const currentId = controllerState.currentId || params.currentId;
            this.loadParams = {
                context: params.context,
                count: params.count || ((this.ids !== undefined) &&
                    this.ids.length) || 0,
                domain: params.domain,
                modelName: params.modelName,
                res_id: currentId,
                res_ids: controllerState.resIds || params.ids || (currentId ? [currentId] : undefined),
            };

            const useSampleModel = 'useSampleModel' in params ?
                                params.useSampleModel :
                                !!(this.arch.attributes.sample && JSON.parse(this.arch.attributes.sample));

            this.modelParams = {
                fields: this.fields,
                modelName: params.modelName,
                useSampleModel,
            };
            if (useSampleModel) {
                this.modelParams.SampleModel = this.components.Model;
            }

            const defaultOrder = this.arch.attributes.default_order;
            if (defaultOrder) {
                this.loadParams.orderedBy = defaultOrder.split(',').map((order) => {
                    order = order.trim().split(' ');
                    return {name: order[0], asc: order[1] !== 'desc'};
                });
            }
            if (params.searchQuery) {
                this._updateMVCParams(params.searchQuery);
            }

            this.extractParams(params);

            this.withControlPanel = this.constructor.withControlPanel && params.withControlPanel;
            this.withSearchPanel = this.constructor.withSearchPanel &&
                this.constructor.multiRecord && params.withSearchPanel &&
                !('search_panel' in params.context && !params.search_panel);

            const searchModelParams = Object.assign({}, params, { action });
            if (this.withControlPanel || this.withSearchPanel) {
                const { arch, fields, favoriteFilters } = params.controlPanelFieldsView || {};
                const archInfo = ActionModel.extractArchInfo({ search: arch }, this.constructor.viewType);
                const controlPanelInfo = archInfo[this.constructor.components.ControlPanel.modelExtension];
                const searchPanelInfo = archInfo[this.constructor.components.SearchPanel.modelExtension];
                this.withSearchPanel = this.withSearchPanel && Boolean(searchPanelInfo);
                Object.assign(searchModelParams, {
                    fields,
                    favoriteFilters,
                    controlPanelInfo,
                    searchPanelInfo,
                });
            }
            const searchModel = this._createSearchModel(searchModelParams);
            this.searchModel = searchModel;
            if (this.controlPanel) {
                this.controlPanel.props.searchModel = searchModel;
            }
            if (this.searchPanel) {
                this.searchPanel.props.searchModel = searchModel;
            }

            Object.assign(this.controlPanel.props, {
                title: this.getTitle(),
            });

            this.model = new ModelAdapter(this.env, this.constructor.components.Model, this.modelParams);
        }

        async willStart() {
            await this.searchModel.load();
            this._updateMVCParams(this.searchModel.get("query"));

            const { state, handle } = await this._loadData();
            Object.assign(this.rendererParams, state);
            this.initialState = this.model.get(handle);
            this.handle = handle;

            await super.willStart();
        }
        mounted() {
            super.mounted(...arguments);

            this.searchModel.on('search', this, this._onSearch);
            this._pushState();
        }

        async update(params, options={}) {
            const shouldReload = 'reload' in options ? options.reload : true;
            if (shouldReload) {
                this.handle = await this.model.reload(this.handle, params);
            }
            const state = this.model.get(this.handle, { withSampleData: true });
            Object.assign(this.rendererParams, state);
            this.state.rev += 1;
        }
        extractParams(params) {
        }

        _extractParamsFromAction(action) {
            action = action || {};
            const context = action.context || {};
            const inline = action.target === 'inline';
            const params = {
                actionId: action.id || false,
                actionViews: action.views || [],
                activateDefaultFavorite: !context.active_id && !context.active_ids,
                context: action.context || {},
                controlPanelFieldsView: action.controlPanelFieldsView,
                currentId: action.res_id ? action.res_id : undefined,  // load returns 0
                displayName: action.display_name || action.name,
                domain: action.domain || [],
                limit: action.limit,
                modelName: action.res_model,
                noContentHelp: action.help,
                searchMenuTypes: inline ? [] : this.constructor.searchMenuTypes,
                withBreadcrumbs: 'no_breadcrumbs' in context ? !context.no_breadcrumbs : true,
                withControlPanel: this.constructor.withControlPanel,
                withSearchBar: inline ? false : this.constructor.withSearchBar,
                withSearchPanel: this.constructor.withSearchPanel,
            };
            if ('useSampleModel' in action) {
                params.useSampleModel = action.useSampleModel;
            }
            return params;
        }
        _processFieldsView(fieldsView) {
            const fv = Object.assign({}, fieldsView);
            fv.arch = parseArch(fv.arch);
            fv.viewFields = Object.assign({}, fv.viewFields, fv.fields);
            return fv;
        }
        _updateMVCParams(searchQuery) {
            this.loadParams = Object.assign(this.loadParams, {
                context: searchQuery.context,
                domain: searchQuery.domain,
                groupedBy: searchQuery.groupBy,
            });
            this.loadParams.orderedBy = Array.isArray(searchQuery.orderedBy) && searchQuery.orderedBy.length ?
                                        searchQuery.orderedBy :
                                        this.loadParams.orderedBy;
            if (searchQuery.timeRanges) {
                this.loadParams.timeRanges = searchQuery.timeRanges;
                this.rendererParams.timeRanges = searchQuery.timeRanges;
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
                this.withControlPanel = true;
                // Control panel (Component)
                const controlPanelProps = {
                    action: params.action,
                    breadcrumbs: params.breadcrumbs,
                    fields,
                    searchMenuTypes: params.searchMenuTypes,
                    view: this.fieldsView,
                    views: params.action.views && params.action.views.filter(
                        v => v.multiRecord === this.constructor.multiRecord
                    ),
                    withBreadcrumbs: params.withBreadcrumbs,
                    withSearchBar: params.withSearchBar,
                };
                this.controlPanel = {
                    Component: ControlPanelComponent,
                    props: controlPanelProps,
                };
            }
    
            // Search panel params
            if (this.withSearchPanel) {
                // Search panel (Model)
                const SearchPanelComponent = this.constructor.components.SearchPanel;
                extensions[SearchPanelComponent.modelExtension] = {
                    archNodes: searchPanelInfo.children,
                };
                this.withSearchPanel = true;
                this.rendererParams.withSearchPanel = true;
                // Search panel (Component)
                const searchPanelProps = {
                    importedState: importedState.searchPanel,
                };
                if (searchPanelInfo.attributes.class) {
                    searchPanelProps.className = searchPanelInfo.attributes.class;
                }
                this.searchPanel = {
                    Component: SearchPanelComponent,
                    props: searchPanelProps,
                };
            }

            const searchModel = new ActionModel(extensions, {
                env: this.env,
                modelName: params.modelName,
                context: Object.assign({}, this.loadParams.context),
                domain: this.loadParams.domain || [],
                importedState: importedState.searchModel,
                searchMenuTypes: params.searchMenuTypes,
                searchQuery: params.searchQuery,
                fields,
            });

            return searchModel;
        }
        async _loadData(options = {}) {
            options.withSampleData = 'withSampleData' in options ? options.withSampleData : true;
            const handle = await this.model.load(this.loadParams);
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
            return this.props.viewOptions.action.name || this.arch.getString("string");
        }
        getState() {
            return {};
        }
        _pushState() {
            this.trigger('push_state', {
                controllerID: this.controllerID,
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
            ev.detail.controllerID = this.props.viewOptions.controllerID;
        }
        _onSearch(searchQuery) {
            this.update(searchQuery);
        }
    }

    ViewController.components = {
        Model: AbstractModel,
        ControlPanel,
        SearchPanel,
        View,
    };

    ViewController.defaultProps = {
    };

    Object.assign(ViewController, {
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

    ViewController.template = xml/*xml*/`
        <div class="o_view_controller" t-on-switch-view="_onSwitchView">
            <t t-if="withControlPanel">
                <t t-component="controlPanel.Component"
                   t-props="controlPanel.props"/>
            </t>
            <View t-props="rendererParams"/>
        </div>
    `;

    return ViewController;
});