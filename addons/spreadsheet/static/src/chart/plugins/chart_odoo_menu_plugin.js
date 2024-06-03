/** @odoo-module */

import { coreTypes, helpers } from "@odoo/o-spreadsheet";
import { OdooCorePlugin } from "@spreadsheet/plugins";
import { omit } from "@web/core/utils/objects";

const { deepEquals } = helpers;

/** Plugin that link charts with Odoo menus. It can contain either the Id of the odoo menu, or its xml id. */
export class ChartOdooMenuPlugin extends OdooCorePlugin {
    static getters = /** @type {const} */ (["getChartOdooMenu"]);
    constructor(config) {
        super(config);
        this.odooMenuReference = {};
    }

    /**
     * Handle a spreadsheet command
     * @param {Object} cmd Command
     */
    handle(cmd) {
        switch (cmd.type) {
            case "LINK_ODOO_MENU_TO_CHART":
                this.history.update("odooMenuReference", cmd.chartId, cmd.odooMenuId);
                break;
            case "DELETE_FIGURE":
                this.history.update("odooMenuReference", cmd.id, undefined);
                break;
            case "DUPLICATE_SHEET":
                this.updateOnDuplicateSheet(cmd.sheetId, cmd.sheetIdTo);
                break;
        }
    }

    updateOnDuplicateSheet(sheetIdFrom, sheetIdTo) {
        for (const newChartId of this.getters.getChartIds(sheetIdTo)) {
            const newChartDefinition = this.getters.getChartDefinition(newChartId);
            const newFigure = this.getters.getFigure(sheetIdTo, newChartId);
            const oldChartId = this.getters.getChartIds(sheetIdFrom).find((oldChartId) => {
                const oldChartDefinition = this.getters.getChartDefinition(oldChartId);
                const oldFigure = this.getters.getFigure(sheetIdFrom, oldChartId);
                return (
                    deepEquals(oldChartDefinition, newChartDefinition) &&
                    deepEquals(omit(newFigure, "id"), omit(oldFigure, "id")) // compare size and position
                );
            });
            if (oldChartId && this.odooMenuReference[oldChartId]) {
                this.history.update(
                    "odooMenuReference",
                    newChartId,
                    this.odooMenuReference[oldChartId]
                );
            }
        }
    }

    /**
     * Get odoo menu linked to the chart
     *
     * @param {string} chartId
     * @returns {object | undefined}
     */
    getChartOdooMenu(chartId) {
        const menuId = this.odooMenuReference[chartId];
        return menuId ? this.getters.getIrMenu(menuId) : undefined;
    }

    import(data) {
        if (data.chartOdooMenusReferences) {
            this.odooMenuReference = data.chartOdooMenusReferences;
        }
    }

    export(data) {
        data.chartOdooMenusReferences = this.odooMenuReference;
    }
}

coreTypes.add("LINK_ODOO_MENU_TO_CHART");
