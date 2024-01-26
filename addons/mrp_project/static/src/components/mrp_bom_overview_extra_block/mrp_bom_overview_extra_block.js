/** @odoo-module **/
import { BomOverviewExtraBlock } from "@mrp/components/bom_overview_extra_block/mrp_bom_overview_extra_block";

import { patch } from "@web/core/utils/patch";

patch(BomOverviewExtraBlock.prototype, {
    get extraData() {
        return this.props.type === 'services' ? this.props.data.services : super.extraData;
    }
})

BomOverviewExtraBlock.props.type.validate = (t) => t === "services" || BomOverviewExtraBlock.props.type.validate
