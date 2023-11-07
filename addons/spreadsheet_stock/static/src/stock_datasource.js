/** @odoo-module */
import { camelToSnakeObject } from "@spreadsheet/helpers/helpers";
import { ServerData } from "@spreadsheet/data_sources/server_data";

export class StockDataSource {
    constructor(services) {
        this.serverData = new ServerData(services.orm, {
            whenDataIsFetched: () => services.notify(),
        });
    }

    getIn(product_id, location_id,  date_range, posted) {
        return this._fetchStockData("get_stock_in", product_id, location_id,  date_range, posted);
    }

    getOut(product_id, location_id,  date_range, posted) {
        return this._fetchStockData("get_stock_out", product_id, location_id,  date_range, posted);
    }

    getOpening(product_id, location_id,  date, posted) {
        return this._fetchStockData("get_stock_opening", product_id, location_id,  date, posted);
    }

    getClosing(product_id, location_id,  date, posted) {
        return this._fetchStockData("get_stock_closing", product_id, location_id,  date, posted);
    }

    _fetchStockData(method_name, product_id, location_id,  date_range, posted) {
        const vals =this.serverData.batch.get(
            "stock.move.line",
            method_name,
            camelToSnakeObject({ product_id, location_id,  date_range, posted })
        );
        debugger
        return vals
    }
}
