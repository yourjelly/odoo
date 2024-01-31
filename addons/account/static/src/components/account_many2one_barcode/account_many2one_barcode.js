/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Many2OneBarcodeField, many2OneBarcodeField } from "@web/views/fields/many2one_barcode/many2one_barcode_field";

export class AccountMany2oneBarcode extends Many2OneBarcodeField {
    get hasExternalButton() {
        // Keep external button, even if field is specified as 'no_open' so that the user is not
        // redirected to the product when clicking on the field content
        const res = super.hasExternalButton;
        return res || (!!this.props.record.data[this.props.name] && !this.state.isFloating);
    }
}

registry.category("fields").add("account_many2one_barcode", {
    ...many2OneBarcodeField,
    component: AccountMany2oneBarcode,
});
