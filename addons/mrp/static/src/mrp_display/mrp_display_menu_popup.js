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
        this.props.closeMenuPopup(this.props.record);
        this.action.doAction(action, { onClose: this.props.onClose });
    }
}
