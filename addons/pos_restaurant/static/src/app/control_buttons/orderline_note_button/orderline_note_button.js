/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { useService } from "@web/core/utils/hooks";
import { TextAreaPopup } from "@point_of_sale/app/utils/input_popups/textarea_popup";
import { Component } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";

export class OrderlineNoteButton extends Component {
    static template = "pos_restaurant.OrderlineNoteButton";

    setup() {
        this.pos = usePos();
        this.popup = useService("popup");
    }
    get selectedOrderline() {
        return this.pos.get_order().get_selected_orderline();
    }
    async click() {
        if (!this.selectedOrderline) {
            return;
        }

        const oldNote = this.selectedOrderline.getNote();
        const { confirmed, payload: inputNote } = await this.popup.add(TextAreaPopup, {
            startingValue: this.selectedOrderline.getNote(),
            title: _t("Add internal Note"),
        });

        if (confirmed) {
            if (this.selectedOrderline.saved_quantity == 0) {
                this.selectedOrderline.setNote(inputNote);
            } else {
                //If we add a note on a line already ordered, the note should only appear for the unordered quantities
                const qty_with_note =
                    this.selectedOrderline.quantity - this.selectedOrderline.saved_quantity;
                const new_order_line = this.selectedOrderline.clone();
                new_order_line.order = this.selectedOrderline.order;
                new_order_line.set_quantity(qty_with_note);
                new_order_line.setNote(inputNote);
                this.selectedOrderline.set_quantity(this.selectedOrderline.saved_quantity);
                this.selectedOrderline.order.orderlines.push(new_order_line);
            }
        }

        return { confirmed, inputNote, oldNote };
    }
}

ProductScreen.addControlButton({
    component: OrderlineNoteButton,
    condition: function () {
        return this.pos.config.iface_orderline_notes;
    },
});
