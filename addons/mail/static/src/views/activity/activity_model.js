/** @odoo-module */

import { RelationalModel } from "@web/views/relational_model";

export class ActivityModel extends RelationalModel {
    async load(params = {}) {
        const [activityData] = await Promise.all([
            this.fetchActivityData(params),
            super.load(params)
        ]);
        this.activityData = activityData;
    }

    fetchActivityData(params) {
        return this.orm.call("mail.activity", "get_activity_data", [], {
            res_model: this.rootParams.resModel,
            domain: params.domain || this.env.searchModel._domain,
        });
    }
}
