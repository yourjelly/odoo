/** @odoo-module **/

import { Component, onPatched, useState } from "@odoo/owl";
import { effect } from "@web/core/utils/reactive";
import { batched } from "@web/core/utils/timing";
import { sortBy } from "../utils/arrays";
import { ErrorHandler } from "../utils/components";

export class OverlayContainer extends Component {
    static template = "web.OverlayContainer";
    static components = { ErrorHandler };
    static props = { overlays: Object };

    setup() {
        this.state = useState({
            overlays: Object.values(this.props.overlays),
        });

        let prom;

        let toResolve;
        effect(
            batched(async (overlays) => {
                if (prom) {
                    await prom;
                }
                this.state.overlays = Object.values(overlays);

                prom = new Promise((resolve) => {
                    toResolve = resolve;
                });
            }),
            [this.props.overlays]
        );

        onPatched(() => {
            if (toResolve) {
                toResolve();
            }
        });
    }

    get sortedOverlays() {
        return sortBy(this.state.overlays, (overlay) => overlay.sequence);
    }

    handleError(overlay, error) {
        overlay.remove();
        Promise.resolve().then(() => {
            throw error;
        });
    }
}
