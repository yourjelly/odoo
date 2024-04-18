import { Component, useRef, useState } from "@odoo/owl";
import { Colorpicker } from "@web/core/colorpicker/colorpicker";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { useDropdownState } from "@web/core/dropdown/dropdown_hooks";
import { isCSSColor } from "@web/core/utils/colors";
import { isColorGradient } from "@html_editor/utils/color";

// These colors are already normalized as per normalizeCSSColor in @web/legacy/js/widgets/colorpicker
const DEFAULT_COLORS = [
    ["#000000", "#424242", "#636363", "#9C9C94", "#CEC6CE", "#EFEFEF", "#F7F7F7", "#FFFFFF"],
    ["#FF0000", "#FF9C00", "#FFFF00", "#00FF00", "#00FFFF", "#0000FF", "#9C00FF", "#FF00FF"],
    ["#F7C6CE", "#FFE7CE", "#FFEFC6", "#D6EFD6", "#CEDEE7", "#CEE7F7", "#D6D6E7", "#E7D6DE"],
    ["#E79C9C", "#FFC69C", "#FFE79C", "#B5D6A5", "#A5C6CE", "#9CC6EF", "#B5A5D6", "#D6A5BD"],
    ["#E76363", "#F7AD6B", "#FFD663", "#94BD7B", "#73A5AD", "#6BADDE", "#8C7BC6", "#C67BA5"],
    ["#CE0000", "#E79439", "#EFC631", "#6BA54A", "#4A7B8C", "#3984C6", "#634AA5", "#A54A7B"],
    ["#9C0000", "#B56308", "#BD9400", "#397B21", "#104A5A", "#085294", "#311873", "#731842"],
    ["#630000", "#7B3900", "#846300", "#295218", "#083139", "#003163", "#21104A", "#4A1031"],
];

export class ColorSelector extends Component {
    static template = "html_editor.ColorSelector";
    static components = { Dropdown, Colorpicker };
    static props = {
        type: String, // either foreground or background
        dispatch: Function,
        getSelection: Function,
        getUsedCustomColors: Function,
    };

    setup() {
        this.DEFAULT_COLORS = DEFAULT_COLORS;
        this.dropdown = useDropdownState({
            onClose: () => this.props.dispatch("COLOR_RESET_PREVIEW"),
        });

        this.state = useState({ activeTab: "solid" });
        this.colorWrapperEl = useRef("colorsWrapper");
    }

    setTab(tab) {
        this.state.activeTab = tab;
    }

    processColorFromEvent(ev) {
        let color = ev.target.dataset.color;
        if (color && !isCSSColor(color) && !isColorGradient(color)) {
            color = (this.props.type === "foreground" ? "text-" : "bg-") + color;
        }
        return color;
    }

    onColorApply(ev, { closeDropdown = true } = {}) {
        const color = ev.hex ? ev.hex : this.processColorFromEvent(ev);
        const mode = this.props.type === "foreground" ? "color" : "background";
        this.props.dispatch("APPLY_COLOR", { color, mode });
        if (closeDropdown) {
            this.dropdown.close();
        }
    }

    onColorPreview(ev) {
        const color = ev.hex ? ev.hex : this.processColorFromEvent(ev);
        const mode = this.props.type === "foreground" ? "color" : "background";
        this.props.dispatch("COLOR_PREVIEW", { color, mode });
    }

    onColorHover(ev) {
        if (ev.target.tagName !== "BUTTON") {
            return;
        }
        this.onColorPreview(ev);
    }

    onColorHoverOut(ev) {
        if (ev.target.tagName !== "BUTTON") {
            return;
        }
        this.props.dispatch("COLOR_RESET_PREVIEW");
    }
}
