/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { BomOverviewLine } from "@mrp/components/bom_overview_line/mrp_bom_overview_line";

patch(BomOverviewLine.prototype, {

    _shouldBeGreyedOut(data) {
        return data.type === 'service' || super._shouldBeGreyedOut(data);
    }

});
