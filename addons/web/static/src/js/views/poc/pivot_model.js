odoo.define("poc.PivotModelExtension", function (require) {
    "use strict";

    const ActionModel = require("web/static/src/js/views/action_model.js");
    const ViewModelExtension = require("poc.ViewModelExtension");

    class PivotModelExtension extends ViewModelExtension {
        constructor() {
            super(...arguments);
            console.log("constructor", ...arguments);

            this.currentFacets = null;
            this.currentDomain = null;

            this.promise = null;
        }

        //---------------------------------------------------------------------
        // Public
        //---------------------------------------------------------------------

        async callLoad() {
            if (!this.shouldLoad) {
                const previousFacets = this.currentFacets;
                this.currentFacets = this.config.get("facets");
                const facetsChanged = JSON.stringify(previousFacets) !==
                    JSON.stringify(this.currentFacets);

                const previousDomain = this.currentDomain;
                this.currentDomain = this.config.get("domain");
                const domainChanged = JSON.stringify(previousDomain) !==
                    JSON.stringify(this.currentDomain);

                this.shouldLoad = facetsChanged || domainChanged;
            }
            await super.callLoad(...arguments);
        }

        importState() {
            console.log("importState", ...arguments);
            return super.importState(...arguments);
        }

        async isReady() {
            await this.promise;
        }

        async load() {
            await super.load(...arguments);
            this.promise = this._loadData();
            await this.promise;
        }

        prepareState() {
            Object.assign(this.state, {
            });
        }

        //---------------------------------------------------------------------
        // Actions / Getters
        //---------------------------------------------------------------------


        //---------------------------------------------------------------------
        // Private
        //---------------------------------------------------------------------

        _getGroupBy() {
            const groupBy = this.config.get("groupBy");
            console.log(groupBy);
        }

        _getGroupBys() {
            this._getGroupBy();

            return {
                //colGroupBys: this.data.colGroupBys.concat(this.data.expandedColGroupBys),
                //rowGroupBys: this.data.rowGroupBys.concat(this.data.expandedRowGroupBys),
            };
        }

        async _loadData() {
            this.rowGroupTree = { root: { labels: [], values: [] }, directSubTrees: new Map() };
            this.colGroupTree = { root: { labels: [], values: [] }, directSubTrees: new Map() };
            this.measurements = {};
            this.counts = {};

            const key = JSON.stringify([[], []]);
            this.groupDomains = {};
            // this.groupDomains[key] = this.data.domains.slice(0);

            const group = { rowValues: [], colValues: [] };
            const groupBys = this._getGroupBys();
            //const leftDivisors = sections(groupBys.rowGroupBys);
            //const rightDivisors = sections(groupBys.colGroupBys);
            //const divisors = cartesian(leftDivisors, rightDivisors);

            // return this._subdivideGroup(group, divisors.slice(0, 1)).then(function () {
            //     return self._subdivideGroup(group, divisors.slice(1));
            // });
        }

        _getGroupSubdivision() {
            return this.env.services.rpc({
                model: this.config.modelName,
                method: 'read_group',
                context: this.config.context,
                domain: this.config.domain,
                fields: [],
                //groupBy: groupBy,
                lazy: false,
            }).then(console.log);
        }
    }
    ActionModel.registry.add("pivot", PivotModelExtension, 50);

    return PivotModelExtension;
});
