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

    convertToDateRange(dateRangeObj) {
        let startDate, endDate;
    
        if (!dateRangeObj || typeof dateRangeObj !== 'object') {
            throw new Error('Invalid date range object');
        }
    
        switch (dateRangeObj.rangeType) {
            case 'year':
                startDate = new Date(Date.UTC(dateRangeObj.year, 0, 1, 12));
                endDate = new Date(Date.UTC(dateRangeObj.year, 11, 31, 12));
                break;
            case 'quarter':
                const monthStart = (dateRangeObj.quarter - 1) * 3;
                startDate = new Date(Date.UTC(dateRangeObj.year, monthStart, 1, 12));
                endDate = new Date(Date.UTC(dateRangeObj.year, monthStart + 3, 0, 12));
                break;
            case 'month':
                startDate = new Date(Date.UTC(dateRangeObj.year, dateRangeObj.month - 1, 1, 12));
                endDate = new Date(Date.UTC(dateRangeObj.year, dateRangeObj.month, 0, 12));
                break;
            case 'day':
                startDate = new Date(Date.UTC(dateRangeObj.year, dateRangeObj.month - 1, dateRangeObj.day, 12));
                endDate = startDate;
                break;
            default:
                throw new Error(`Invalid range type: ${dateRangeObj.range_type}`);
        }
    
        if (startDate && endDate) {
            return {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            };
        } else {
            throw new Error('Could not determine start date or end date.');
        }
    }
    
    // -------------------------------------------------------------------------
    // Getters
    // -------------------------------------------------------------------------

    getStockIn(product_id, location_id, date_range, posted) {
        const { startDate, endDate } = this.convertToDateRange(date_range);
        return (
            this.dataSources &&
            this.dataSources
                .get(DATA_SOURCE_ID)
                .getIn(product_id, location_id, startDate, endDate, posted)
        );
    }

    getStockOut(product_id, location_id, date_range, posted) {
        const { startDate, endDate } = this.convertToDateRange(date_range);
        return (
            this.dataSources &&
            this.dataSources
                .get(DATA_SOURCE_ID)
                .getOut(product_id, location_id, startDate, endDate, posted)
        );
    }

    getStockClosing(product_id, location_id, date_range, posted) {
        const { startDate, endDate } = this.convertToDateRange(date_range);
        return (
            this.dataSources &&
            this.dataSources
                .get(DATA_SOURCE_ID)
                .getOpening(product_id, location_id, startDate, endDate, posted)
        );
    }

    getStockOpening(product_id, location_id, date_range, posted) {
        const { startDate, endDate } = this.convertToDateRange(date_range);
        return (
            this.dataSources &&
            this.dataSources
                .get(DATA_SOURCE_ID)
                .getClosing(product_id, location_id, startDate, endDate, posted)
        );
    }
}

StockPlugin.getters = [
    "getStockIn",
    "getStockOut",
    "getStockClosing",
    "getStockOpening"
];
