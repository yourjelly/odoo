/* @odoo-module */

import { Component, onMounted, onWillDestroy, useExternalListener, useRef, useState, xml } from "@odoo/owl";
import { SelectionField } from "@web/views/fields/selection/selection_field";
import { getFieldDomain } from "@web/model/relational_model/utils";
import { Record } from "@web/model/record";
import { useModel } from "@web/model/model";
import { useService, useAutofocus } from "@web/core/utils/hooks";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";


export class PeppolInvoiceResponseCondition extends Component {
    static template = xml`
        <td>
            <input
                class="form-control"
                placeholder="Attribute ID ..."
                t-on-change="onChangeAttributeID"
                t-att-value="state.attributeID"
                t-ref="attributeIDText"
            />
            <textarea
                class="form-control"
                placeholder="Description ..."
                t-att-value="state.description"
                t-ref="descriptionText"
            />
        </td>
    `;

    static props = {
        attributeID: { type: String, optional: true },
        description: { type: String, optional: true },
    };

    setup() {
        this.textArea = useRef("conditionText");
        this.state = useState({
            attributeID: this.props.attributeID || "",
            description: this.props.description || "",
        })
        this.textAreaDescription = useRef("descriptionText");
        if (this.state.attributeID.length) {
            this.textAreaAttributeID = useRef("attributeIDText");
        } else {
            this.textAreaAttributeID = useAutofocus({ refName: "attributeIDText" });
        }
    }

    onChangeAttributeID(ev) {
        this.state['attributeID'] = ev.target.value;
    }


}

export class PeppolInvoiceResponseStatus extends Component {
    static template = "account_peppol_invoice_response.peppol_response_popover_status";
    static props = {
        statusType: { type: String, optional: true },
        code: { type: String, optional: true },
        condition: { type: String, optional: true },
    };
    static components = {
        PeppolInvoiceResponseCondition,
    };

    setup() {
        this.state = useState({
            statusType: this.props.statusType || "reason",
            code: this.props.code || "AB",
            conditions: []
        })
    }

    onChangeStatusType(ev) {
        this.state['statusType'] = ev.target.value;
    }

    onChangeStatusCode(ev) {
        this.state['code'] = ev.target.value;
    }

    onClickAddCondition(ev) {
        this.state.conditions.push({
            attributeID: '',
            description: '',
        })
    }

    get statusActionCodes() {
        return {
            NOA: 'No action required',
            PIN: 'Provide information',
            NIN: 'Issue new invoice',
            CNF: 'Credit fully',
            CNP: 'Credit partially',
            CNA: 'Credit the amount',
            OTH: 'Other',
        }
    }

    get statusReasonCodes() {
        return {
            NON: 'No Issue',
            REF: 'References incorrect',
            LEG: 'Legal information incorrect',
            REC: 'Receiver unknown',
            QUA: 'Item quality insufficient',
            DEL: 'Delivery issues',
            PRI: 'Prices incorrect',
            QTY: 'Quantity incorrect',
            ITM: 'Items incorrect',
            PAY: 'Payment terms incorrect',
            UNR: 'Not recognized',
            FIN: 'Finance incorrect',
            PPD: 'Partially Paid',
            OTH: 'Other',
        }
    }


}

export class ActivityPeppolResponsePopover extends Component {
    static template = "account_peppol_invoice_response.peppol_response_popover";
    static props = {
        id: { type: Number, required: true },
        hasHeader: { type: Boolean, optional: true },
        reload: { type: Function, optional: true },
        close: { type: Function, optional: true },
        code: { type: String, optional: true },
    };
    static components = {
        Dropdown,
        DropdownItem,
        PeppolInvoiceResponseStatus,
    };

    setup() {
        this.orm = useService("orm");
        this.state = useState({
            code: this.props.code || "AB",
            status_ids: [],
        });
        onWillDestroy(async () => {
            if (this.currentPromise) {
                await this.currentPromise;
            }
        });
    }

    get peppolInvoiceResponseCodes() {
        return {
            AB: "Message acknowledgement",
            AP: "Accepted",
            RE: "Rejected",
            IP: "In process",
            UQ: "Under query",
            CA: "Conditionally accepted",
            PD: "Paid",
        }
    }

    onClickAddStatus() {
        this.state.status_ids.push({
            statusType: 'reason',
            code: '',
            conditions: [],
        })
    }
}
