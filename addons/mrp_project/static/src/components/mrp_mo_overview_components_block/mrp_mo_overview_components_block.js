/** @odoo-module **/

import { MoOverviewComponentsBlock } from "@mrp/components/mo_overview_components_block/mrp_mo_overview_components_block";
import { MoOverviewServicesBlock } from "../mo_overview_services_block/mrp_mo_overview_services_block";

MoOverviewComponentsBlock.props = {
    ...MoOverviewComponentsBlock.props,
    services: {
        type: Object,
        shape: {
            summary: Object,
            details: Array,
        },
        optional: true,
    },
}

MoOverviewComponentsBlock.components = {
    ...MoOverviewComponentsBlock.components,
    MoOverviewServicesBlock
}
