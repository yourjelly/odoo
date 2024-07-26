import { _t } from "@web/core/l10n/translation";
import { Component } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { TextInputPopup } from "@point_of_sale/app/utils/input_popups/text_input_popup";
import { useService } from "@web/core/utils/hooks";
import { makeAwaitable } from "@point_of_sale/app/store/make_awaitable_dialog";

export class OrderlineNoteButton extends Component {
    static template = "point_of_sale.OrderlineNoteButton";
    static props = {
        icon: { type: String, optional: true },
        label: { type: String, optional: true },
        getter: { type: Function, optional: true },
        setter: { type: Function, optional: true },
        class: { type: String, optional: true },
    };
    static defaultProps = {
        label: _t("Customer Note"),
        getter: (orderline) => orderline.get_customer_note(),
        setter: (orderline, note) => orderline.set_customer_note(note),
        class: "",
    };

    setup() {
        this.pos = usePos();
        this.dialog = useService("dialog");
    }

    async lineChanges(selectedOrderline, payload, newNotes = []) {
        var quantity_with_note = 0;
        const changes = this.pos.getOrderChanges();
        for (const key in changes.orderlines) {
            if (changes.orderlines[key].uuid == selectedOrderline.uuid) {
                quantity_with_note = changes.orderlines[key].quantity;
                break;
            }
        }
        const saved_quantity = selectedOrderline.qty - quantity_with_note;
        if (saved_quantity > 0 && quantity_with_note > 0) {
            await this.pos.addLineToCurrentOrder({
                product_id: selectedOrderline.product_id,
                qty: quantity_with_note,
                note_ids: [["link", ...newNotes]],
            });
            selectedOrderline.qty = saved_quantity;
        } else {
            this.props.setter(selectedOrderline, payload);
        }
        return { quantity_with_note, saved_quantity };
    }

    async onClick() {
        const selectedOrderline = this.pos.get_order().get_selected_orderline();
        const selectedNote = this.props.getter(selectedOrderline);
        const payload = await this.openTextInput(selectedNote, false);
        this.lineChanges(selectedOrderline, payload, []);
        return { confirmed: typeof payload === "string", inputNote: payload };
    }

    async openTextInput(selectedNote, displayNotes) {
        let buttons = [];
        if (displayNotes) {
            buttons = this.pos.models["pos.note"].getAll().map((note) => ({
                id: note.id,
                label: note.name,
                isSelected: selectedNote.includes(note.name), // Check if the note is already selected
                class: note.color ? `o_colorlist_item_color_${note.color}` : "",
            }));
            const allowed_notes = this.pos.config.note_ids.map((n) => n.id);
            if (allowed_notes.length) {
                buttons = buttons.filter((x) => allowed_notes.includes(x.id) || x.isSelected);
            }
        }
        return await makeAwaitable(this.dialog, TextInputPopup, {
            title: _t("Add %s", this.props.label),
            buttons,
            rows: 4,
            startingValue: selectedNote,
        });
    }
}

export class InternalNoteButton extends OrderlineNoteButton {
    static template = "point_of_sale.OrderlineNoteButton";
    static props = {
        ...OrderlineNoteButton.props,
    };
    async onClick() {
        const selectedOrderline = this.pos.get_order().get_selected_orderline();
        const selectedNote = Array.from(selectedOrderline.note_ids);
        const payload = await this.openTextInput(selectedNote.map((n) => n.name).join("\n"), true);
        const newNotes = await this.props.setter(selectedOrderline, payload, true);
        super.lineChanges(selectedOrderline, payload, newNotes);
        return {
            confirmed: typeof payload === "string",
            inputNote: newNotes.map((n) => n.id),
            oldNote: selectedNote.map((n) => n.id),
        };
    }
}
