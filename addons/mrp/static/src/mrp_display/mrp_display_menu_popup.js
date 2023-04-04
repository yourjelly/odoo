/** @odoo-module */

import { Component } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class MrpDisplayMenuPopup extends Component {
    static template = "mrp.MrpDisplayMenuPopup";

    static props = {
        closeMenuPopup: Function,
        record: Object,
    };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
    }

    async callAction(method) {
        const action = await this.orm.call(this.props.record.resModel, method, [
            [this.props.record.resId],
        ]);
        this.action.doAction(action, {
            onClose: async () => {
                // TODO: Need to update the record here. But how to know which move was updated
                // or how to get the new move if one was created ?
                this.props.closeMenuPopup();
            },
        });
    }
}
