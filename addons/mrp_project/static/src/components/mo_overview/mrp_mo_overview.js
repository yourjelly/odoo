/** @odoo-module **/
import { MoOverview } from "@mrp/components/mo_overview/mrp_mo_overview";

import { patch } from "@web/core/utils/patch";

patch(MoOverview.prototype, {
    get hasServices() {
        return this.state.data?.services?.details?.length > 0;
    },

    async getManufacturingData() {
        await super.getManufacturingData();
        if (this.state.data?.services?.summary?.index) {
            this.unfoldedIds.add(this.state.data.services.summary.index);
        }
    }
})
