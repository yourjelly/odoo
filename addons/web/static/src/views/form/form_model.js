/* @odoo-module */

import { KeepLast } from "@web/core/utils/concurrency";
import { Model } from "@web/views/helpers/model";

export class FormModel extends Model {
    static services = ["orm"];

    setup({ orm }) {
        this.orm = orm;
        this.keepLast = new KeepLast();
    }

    load(params) {
        this.model = params.resModel;
        this.archInfo = params.archInfo;
        return this.loadData(params.resId);
    }

    reload(params) {
        return this.loadData(params.domain);
    }

    async loadData(resId) {
        const fields = this.archInfo.fields;
        const records = await this.keepLast.add(this.orm.read(this.model, [resId], fields));
        this.data = records[0];
        debugger;
        this.notify();
    }
}
