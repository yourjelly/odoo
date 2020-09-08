odoo.define("poc.PivotModelExtension", function (require) {
    "use strict";

    const ActionModel = require("web/static/src/js/views/action_model.js");
    const ViewModelExtensionAdapter = require("poc.ViewModelExtensionAdapter");

    const PivotModel = require("web.PivotModel");

    class PivotModelExtension extends ViewModelExtensionAdapter {
        constructor() {
            super(PivotModel, ...arguments);

            this.awaitPromise = null;
        }

        //---------------------------------------------------------------------
        // Public
        //---------------------------------------------------------------------

        async load() {
            if (this.awaitPromise) {
                await this.awaitPromise;
                this.awaitPromise = null;
                this.reset = true;
            } else {
                await super.load(...arguments);
            }
        }

        //---------------------------------------------------------------------
        // Actions / Getters
        //---------------------------------------------------------------------

        addGroupBy(groupBy, selectedGroup) {
            this.legacyModel.addGroupBy(groupBy, selectedGroup.type);
            this.expandGroup(selectedGroup, groupBy);
        }
        closeGroup() {
            this.legacyModel.closeGroup(...arguments);
            this.reset = true;
        }
        expandAll() {
            this.awaitPromise = this.legacyModel.expandAll(...arguments);
            this.shouldLoad = true;
        }
        expandGroup() {
            this.awaitPromise = this.legacyModel.expandGroup(...arguments);
            this.shouldLoad = true;
        }
        flip() {
            this.legacyModel.flip(...arguments);
            this.reset = true;
        }
        get(property, ...args) {
            switch (property) {
                case "groupDomain": return this.legacyModel._getGroupDomain(...args);
                default: return super.get(...arguments);
            }
        }
        sortRows() {
            this.legacyModel.sortRows(...arguments);
            this.reset = true;
        }
        toggleMeasure(fieldName) {
            this.reloadArgs = { measure: fieldName };
            this.shouldLoad = true;
        }
    }
    ActionModel.registry.add("pivot", PivotModelExtension, 50);

    return PivotModelExtension;
});
