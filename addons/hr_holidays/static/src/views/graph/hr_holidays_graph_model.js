/** @odoo-module **/

import { GraphModel } from "@web/views/graph/graph_model";

export class HrHolidaysGraphModel extends GraphModel {
    async load(searchParams) {
        if (searchParams.groupBy.length != 0 && !searchParams.groupBy.includes('leave_type')){
            searchParams.groupBy.push('leave_type');
        }
        await super.load(...arguments);
    }

    _getLineOverlayDataset() {
        // Given that there are at least 2 stacks one for allocation and one for time off
        // then there shouldn't be a lineOverlay. 
        return null;
    }
}
