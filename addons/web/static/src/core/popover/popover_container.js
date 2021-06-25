/** @odoo-module **/

import { useClickAway } from "../click_away_hook";
import { Popover } from "./popover";

const { Component } = owl;
const { useState } = owl.hooks;
const { xml } = owl.tags;

class PopoverController extends Component {
    setup() {
        this.state = useState({ displayed: false });
        this.targetObserver = new MutationObserver(this.onTargetMutate.bind(this));

        useClickAway(this.props.close, {
            ignoreWhen: (target) => {
                return !this.props.closeOnClickAway || this.target.contains(target);
            },
        });
    }
    mounted() {
        this.targetObserver.observe(this.target.parentElement, { childList: true });
    }
    willUnmount() {
        this.targetObserver.disconnect();
    }

    shouldUpdate() {
        return false;
    }

    get popoverProps() {
        return {
            target: this.target,
            position: this.props.position,
            popoverClass: this.props.popoverClass,
        };
    }
    get target() {
        if (typeof this.props.target === "string") {
            return document.querySelector(this.props.target);
        } else {
            return this.props.target;
        }
    }
    onTargetMutate() {
        const target = this.target;
        if (!target || !target.parentElement) {
            this.props.close();
        }
    }
}
PopoverController.components = { Popover };
PopoverController.defaultProps = {
    alwaysDisplayed: false,
    closeOnClickAway: true,
};
PopoverController.template = xml/*xml*/ `
    <Popover t-props="popoverProps" t-on-popover-closed="props.close()">
        <t t-component="props.Component" t-props="props.props" />
    </Popover>
`;

export class PopoverContainer extends Component {
    setup() {
        this.props.bus.on("UPDATE", this, this.render);
    }
}
PopoverContainer.components = { PopoverController };
PopoverContainer.template = xml`
    <div class="o_popover_container">
        <t t-foreach="Object.values(props.popovers)" t-as="popover" t-key="popover.id">
            <PopoverController t-props="popover" />
        </t>
    </div>
`;
