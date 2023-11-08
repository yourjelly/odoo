/** @odoo-module */
import { camelToSnakeObject } from "@spreadsheet/helpers/helpers";
import { ServerData } from "@spreadsheet/data_sources/server_data";

export class StockDataSource {
    constructor(services) {
        this.serverData = new ServerData(services.orm, {
            whenDataIsFetched: () => services.notify(),
        });
    }

    getIn(product_id, location_id, startDate, endDate, posted) {
        const data = this._fetchStockData(product_id, location_id, startDate, endDate, posted);
        debugger;
        return data.in_qty;
    }

    getOut(product_id, location_id, startDate, endDate, posted) {
        const data = this._fetchStockData(product_id, location_id, startDate, endDate, posted);
        return data.out_qty;
    }

    getOpening(product_id, location_id, startDate, endDate, posted) {
        const data = this._fetchStockData(product_id, location_id, startDate, endDate, posted);
        return data.opening_stock;
    }

    getClosing(product_id, location_id, startDate, endDate, posted) {
        const data = this._fetchStockData(product_id, location_id, startDate, endDate, posted);
        return data.closing_stock;
    }

    _fetchStockData(product_id, location_id, startDate, endDate, posted) {
        return this.serverData.batch.get(
            "stock.move.line",
            "get_stock_data",
            camelToSnakeObject({ product_id, location_id,  startDate, endDate, posted })
        );
    }
}
