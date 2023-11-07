/** @odoo-module */

import spreadsheet from "@spreadsheet/o_spreadsheet/o_spreadsheet_extended";
import { StockDataSource } from "../stock_datasource";
const DATA_SOURCE_ID = "STOCK_AGGREGATES";

export default class StockPlugin extends spreadsheet.UIPlugin {
    constructor(getters, history, dispatch, config) {
        super(getters, history, dispatch, config);
        this.dataSources = config.dataSources;
        if (this.dataSources) {
            this.dataSources.add(DATA_SOURCE_ID, StockDataSource);
        }
    }

    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    getStockIn(product_id, location_id, date_range, posted) {
        return (
            this.dataSources &&
            this.dataSources
                .get(DATA_SOURCE_ID)
                .getIn(product_id, location_id, date_range, posted)
        );
    }

    getStockOut(product_id, location_id, date_range, posted) {
        return (
            this.dataSources &&
            this.dataSources
                .get(DATA_SOURCE_ID)
                .getOut(product_id, location_id, date_range, posted)
        );
    }

    getStockOpening(product_id, location_id, date, posted) {
        return (
            this.dataSources &&
            this.dataSources
                .get(DATA_SOURCE_ID)
                .getOpening(product_id, location_id, date, posted)
        );
    }

    getStockClosing(product_id, location_id, date, posted) {
        return (
            this.dataSources &&
            this.dataSources
                .get(DATA_SOURCE_ID)
                .getClosing(product_id, location_id, date, posted)
        );
    }
}

StockPlugin.getters = [
    "getStockIn",
    "getStockOut",
    "getStockOpening",
    "getStockClosing"
];
