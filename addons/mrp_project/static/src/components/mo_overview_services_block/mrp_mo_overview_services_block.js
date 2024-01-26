/** @odoo-module **/

import { MoOverviewOperationsBlock } from "@mrp/components/mo_overview_operations_block/mrp_mo_overview_operations_block";
import { MoOverviewLine } from "@mrp/components/mo_overview_line/mrp_mo_overview_line";

export class MoOverviewServicesBlock extends MoOverviewOperationsBlock {
    static components = {
        MoOverviewLine,
    };
    static props = {
        // Keep all props except "operations"
        ...(({ operations, ...props }) => props)(MoOverviewOperationsBlock.props),
        services: Array,
    };

    static template = "mrp_project.MoOverviewServicesBlock";

    //---- Getters ----

    get hasServices() {
        return this.props?.services?.length > 0;
    }

    get level() {
        return this.hasServices ? this.props.services[0].level - 1 : 0;
    }
}
