/** @odoo-module **/

import { orm } from "@web/core/orm";
import { registry } from "@web/core/registry";
import { CharField, charField } from "@web/views/fields/char/char_field";
import { useDebounced } from "@web/core/utils/timing";
import { useState } from "@odoo/owl";

export const DELAY = 400;

export class IbanWidget extends CharField {
    static template = "base_iban.iban";
    setup() {
        super.setup();
        this.state = useState({ isValidIBAN: null });
        this.validateIbanDebounced = useDebounced(async (ev) => {
            const iban = ev.target.value;
            if (!iban) {
                this.state.isValidIBAN = null;
            } else if (!/[A-Za-z]{2}.{3,}/.test(iban)) {
                this.state.isValidIBAN = false;
            } else {
                this.state.isValidIBAN = await orm.call("res.partner.bank", "check_iban", [[], iban]);
            }
        }, DELAY);
    }
}

export const ibanWidget = {
    ...charField,
    component: IbanWidget,
};

registry.category("fields").add("iban", ibanWidget);
