import { Component } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { closestBlock } from "../utils/blocks";
import { getFontSizeDisplayValue } from "../utils/formatting";

export class FontSelector extends Component {
    static template = "html_editor.FontSelector";
    static props = {
        dispatch: Function,
        getSelection: Function,
        document: { type: Object, optional: true },
        getItems: Function,
        command: String,
        isFontSize: { type: Boolean, optional: true },
    };
    static components = { Dropdown, DropdownItem };

    setup() {
        this.items = this.props.getItems();
    }

    get displayName() {
        return this.props.isFontSize ? this.fontSizeName : this.fontName;
    }

    get fontName() {
        const sel = this.props.getSelection();
        if (!sel) {
            return "Normal";
        }
        const anchorNode = sel.anchorNode;
        const block = closestBlock(anchorNode);
        const tagName = block.tagName.toLowerCase();

        const matchingItems = this.items.filter((item) => {
            return item.tagName === tagName;
        });

        if (!matchingItems.length) {
            return "Normal";
        }

        return (
            matchingItems.find((item) => block.classList.contains(item.extraClass)) ||
            matchingItems[0]
        ).name;
    }

    get fontSizeName() {
        const sel = this.props.getSelection();
        if (!sel) {
            return this.items[0].name;
        }
        return Math.round(getFontSizeDisplayValue(sel, this.props.document));
    }

    onSelected(item) {
        this.props.dispatch(this.props.command, item);
    }
}
