/** @odoo-module **/

import { Component } from "@odoo/owl";
import { sortBy } from "../utils/arrays";
import { ErrorHandler } from "../utils/components";

export class OverlayContainer extends Component {
    static template = "web.OverlayContainer";
    static components = { ErrorHandler };
    static props = { overlays: Object };

    setup() {
        if (this.props.getOverlayIndex) {
            this.props.getOverlayIndex.invoke = this.getOverlayIndex.bind(this);
        }
    }

    get sortedOverlays() {
        return sortBy(Object.values(this.props.overlays), (overlay) => overlay.sequence);
    }

    handleError(overlay, error) {
        overlay.remove();
        Promise.resolve().then(() => {
            throw error;
        });
    }

    getOverlayIndex(el) {
        const nodes = this.ref.children;
        for (let i = 0; i < nodes.length; i++) {
            const element = nodes[i];
            if (element.contains(el)) {
                return i;
            }
        }
        return -1;
    }
}
