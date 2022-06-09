/** @odoo-module **/

import { Dialog } from "@web/core/dialog";
import { FormController } from "@web/views/form"; // "@web/views/form/form_controller" ?
import { _t } from "@web/core/l10n/translation";
import { isX2Many } from "@web/views/helpers/view_utils";

export class SaleOrderFormController extends FormController {
     setup() {
        super.setup();

        // TODO
     }

    isEqualValue(type, fieldName, orderLines) {
        let isEqualValue;
        let secondValue = orderLines[1].data[fieldName];

        if (type === "normal" {
            // moment ???
            if (secondValue instanceof moment) {
                isEqualValue = orderLines.slice(1).every(line => secondValue.isSame(line.data[fieldName]));
            } else {
                isEqualValue = orderLines.slice(1).every(line => secondValue === line.data[fieldName]);
            }
        } else if (type === "one2many") {
            if (secondValue.data && secondValue.data.display_name) {
                secondValue = secondValue.data.display_name;
                isEqualValue = orderLines.slice(1).every(line => line.data[fieldName] && secondValue === line.data[fieldName].data.display_name);
            } else {
                isEqualValue = orderLines.slice(1).every(line => secondValue === line.data[fieldName])
            }
        }

        return isEqualValue
    }

    // isDialogReady
    DialogReady(ev, type) {
        const recordData = ev.target.recordData;
        const fieldName = ev.data.fieldName;
        const orderLines = this.renderer.state.data.order_line.data.filter(line => !line.data.display_name);

        if (orderLines.length < 3) {
            return false;
        } else if (recordData.id === orderLines[0].data.id && this.isEqualValue(type, fieldName, orderLines)) {
            return orderLines;
        } else {
            return false;
        }
    }
}
