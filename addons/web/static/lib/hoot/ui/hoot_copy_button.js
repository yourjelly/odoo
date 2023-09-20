/** @odoo-module **/

import { Component, useState } from "@odoo/owl";
import { compactXML, copy } from "../utils";

/** @extends Component<{}, import("../hoot").Environment> */
export class HootCopyButton extends Component {
    static props = { text: String };

    static template = compactXML/* xml */ `
        <button
            class="hoot-copy"
            t-att-class="{ 'hoot-copied': state.copied }"
            title="copy to clipboard"
            t-on-click.synthetic="onClick"
        >
            <i t-attf-class="bi bi-{{ state.copied ? 'clipboard-check' : 'clipboard' }}-fill" />
        </button>
    `;

    setup() {
        this.state = useState({ copied: false });
    }

    async onClick() {
        await copy(this.props.text);
        this.state.copied = true;
    }
}
