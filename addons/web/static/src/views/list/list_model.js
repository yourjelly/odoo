/* @odoo-module */

import { KeepLast } from "@web/core/utils/concurrency";
import { Model } from "@web/views/helpers/model";

export class ListModel extends Model {
    static services = ["orm"];

    setup({ orm }) {
        this.orm = orm;
        this.keepLast = new KeepLast();
    }

    load(params) {
        this.model = params.resModel;
        this.columns = params.columns;
        return this.loadData(params.domain);
    }

    reload(params) {
        return this.loadData(params.domain);
    }

    async loadData(domain) {
        const fields = this.columns.map((col) => col.name);
        this.data = await this.keepLast.add(
            this.orm.searchRead(this.model, domain, fields, { limit: 40 })
        );
        this.notify();
    }
}
