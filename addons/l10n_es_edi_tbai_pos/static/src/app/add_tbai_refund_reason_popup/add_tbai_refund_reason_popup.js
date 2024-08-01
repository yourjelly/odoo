import { Dialog } from "@web/core/dialog/dialog";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { Component, useState } from "@odoo/owl";

export class AddTbaiRefundReasonPopup extends Component {
    static template = "l10n_es_edi_tbai_pos.AddTbaiRefundReasonPopup";
    static components = { Dialog };

    setup() {
        this.pos = usePos();
        this.state = useState({});
    }
    confirm() {
        this.props.getPayload(this.state);
        this.props.close();
    }
}
