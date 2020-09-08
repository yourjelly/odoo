odoo.define("poc.ViewModelExtensionAdapter", function (require) {
    "use strict";

    const ViewModelExtension = require("poc.ViewModelExtension");

    class ViewModelExtensionAdapter extends ViewModelExtension {
        constructor(LegacyModel, ...args) {
            super(...args);

            this.currentFacets = null;
            this.currentDomain = null;

            const modelParams = Object.assign({},
                this.config.init,
                { SampleModel: LegacyModel },
            );

            this.legacyModel = new LegacyModel(this, modelParams);
            this.promise = null;
            this.handle = null;
            this.state = null;
            this.reset = false;
            this.reloadArgs = undefined;
        }

        //---------------------------------------------------------------------
        // Public
        //---------------------------------------------------------------------

        async callLoad() {
            if (!this.shouldLoad) {
                this.shouldLoad = this._hasDomainChanged() || this._hasFacetsChanged();
            }
            await super.callLoad(...arguments);
        }

        async load(params) {
            const searchQuery = this.config.get("query");
            const loadArgs = {};

            if (params.isInitialLoad) {
                this.currentDomain = this.config.get("domain");
                this.currentFacets = this.config.get("facets");
                Object.assign(loadArgs, this.config.load, {
                    context: searchQuery.context,
                    domain: searchQuery.domain,
                    groupedBy: searchQuery.groupBy,
                    orderedBy: Array.isArray(searchQuery.orderedBy) && searchQuery.orderedBy.length ?
                        searchQuery.orderedBy :
                        this.config.load.orderedBy,
                    timeRanges: searchQuery.timeRanges,
                });
                this.promise = this.legacyModel.load(loadArgs);
            } else {
                Object.assign(loadArgs, searchQuery, this.reloadArgs);
                this.promise = this.legacyModel.reload(this.handle, loadArgs);
                this.reloadArgs = undefined;
            }
            this.handle = await this.promise;
            this.reset = true;
        }

        //---------------------------------------------------------------------
        // Actions / Getters
        //---------------------------------------------------------------------

        get(property) {
            switch (property) {
                case "state": {
                    if (this.reset) {
                        this.state = this.legacyModel.get(this.handle, { withSampleData: true });
                        this.reset = false;
                    }
                    return this.state;
                }
                case "isInSampleMode": return this.legacyModel.isInSampleMode();
            }
        }

        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        _hasDomainChanged() {
            const previousDomain = this.currentDomain;
            this.currentDomain = this.config.get("domain");
            return JSON.stringify(previousDomain) !== JSON.stringify(this.currentDomain);
        }
        _hasFacetsChanged() {
            const previousFacets = this.currentFacets;
            this.currentFacets = this.config.get("facets");
            return JSON.stringify(previousFacets) !== JSON.stringify(this.currentFacets);
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

    return ViewModelExtensionAdapter;
});
