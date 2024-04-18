import { _t } from "@web/core/l10n/translation";
import { Component } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/hooks/pos_hook";
import { TextInputPopup } from "@point_of_sale/app/components/popups/text_input_popup/text_input_popup";
import { useService } from "@web/core/utils/hooks";
import { makeAwaitable } from "@point_of_sale/app/store/make_awaitable_dialog";

export class NoteButton extends Component {
    static template = "point_of_sale.NoteButton";
    static props = {
        icon: { type: String, optional: true },
        label: { type: String, optional: false },
        type: { type: String, optional: false },
        class: { type: String, optional: true },
    };

    setup() {
        this.pos = usePos();
        this.dialog = useService("dialog");
    }

    async onClick() {
        const selectedOrderline = this.pos.get_order().get_selected_orderline();
        const selectedNote = this.currentNote || "";
        const payload = await this.openTextInput(selectedNote, false);
        if (this.pos.get_order().get_selected_orderline()) {
            this.setChanges(selectedOrderline, payload);
        } else {
            this.pos.get_order().setGeneralCustomerNote(payload);
        }
        return { confirmed: typeof payload === "string", inputNote: payload };
    }

    // Update line changes and set them
    async setChanges(selectedOrderline, payload) {
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
                product_tmpl_id: selectedOrderline.product_id.product_tmpl_id,
                qty: quantity_with_note,
                note: payload,
            });
            selectedOrderline.qty = saved_quantity;
        } else {
            this.setOrderlineNote(payload);
        }
    }

    // Useful to handle name and color together for internal notes
    reframeNotes(payload) {
        const notesArray = [];
        for (const noteName of payload.split("\n")) {
            const defaultNote = this.pos.models["pos.note"].find((note) => note.name === noteName);
            if (defaultNote) {
                notesArray.push({ text: noteName, colorIndex: defaultNote.color });
            } else if (noteName.trim()) {
                const newColor = Math.floor(Math.random() * 11);
                notesArray.push({ text: noteName, colorIndex: newColor });
            }
        }
        return JSON.stringify(notesArray);
    }

    async addOrderNote() {
        const selectedNote = this.currentNote || "";
        const payload = await this.openTextInput(selectedNote);
        this.setNote(payload);
        return { confirmed: typeof payload === "string", inputNote: payload };
    }

    async openTextInput(selectedNote) {
        let buttons = [];
        if (
            this.props.type === "internal" ||
            this.pos.get_order()?.get_selected_orderline() === undefined
        ) {
            buttons = this.pos.models["pos.note"].getAll().map((note) => ({
                label: note.name,
                isSelected: selectedNote.split("\n").includes(note.name), // Check if the note is already selected
                class: note.color ? `o_colorlist_item_color_${note.color}` : "",
            }));
        }
        return await makeAwaitable(this.dialog, TextInputPopup, {
            title: _t("Add %s", this.props.label),
            buttons,
            rows: 4,
            startingValue: selectedNote,
        });
    }

    get orderNote() {
        const order = this.pos.get_order();
        return this.props.type === "internal"
            ? order.internal_note || ""
            : order.general_customer_note || "";
    }

    get orderlineNote() {
        const orderline = this.pos.get_order().get_selected_orderline();
        return this.props.type === "internal" ? orderline.getNote() : orderline.get_customer_note();
    }

    get currentNote() {
        return this.pos.get_order().get_selected_orderline() ? this.orderlineNote : this.orderNote;
    }
    setOrderlineNote(value) {
        return this.pos.get_order().get_selected_orderline().set_customer_note(value);
    }
}
export class InternalNoteButton extends NoteButton {
    static template = "point_of_sale.NoteButton";
    static props = {
        ...NoteButton.props,
    };
    async onClick() {
        const selectedOrderline = this.pos.get_order().get_selected_orderline();
        const selectedNote = JSON.parse(this.currentNote || "[]");
        const payload = await this.openTextInput(selectedNote.map((n) => n.text).join("\n"), true);
        const coloredNotes = this.reframeNotes(payload || "");
        if (this.pos.get_order().get_selected_orderline()) {
            this.setChanges(selectedOrderline, coloredNotes);
        } else {
            this.pos.get_order().setInternalNote(coloredNotes);
        }
        return {
            confirmed: typeof payload === "string",
            inputNote: coloredNotes,
            oldNote: JSON.stringify(selectedNote),
        };
    }
    setOrderlineNote(value) {
        return this.pos.get_order().get_selected_orderline().setNote(value);
    }
}
