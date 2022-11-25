/** @odoo-module **/

import { Component, markup, onPatched, xml, useRef, useState } from "@odoo/owl";

export class TourPointer extends Component {
    static template = xml`
        <div t-ref="tooltip-ref"
            class="o_tooltip"
            t-att-class="extraClasses"
            t-att-style="style"
            t-on-mouseenter="() => props.setPointerState({ mode: 'info' })"
            t-on-mouseleave="() => props.setPointerState({ mode: 'bubble' })">
            <div t-if="props.pointerState.mode === 'info'" class="o_tooltip_content">
                <t t-out="contentMarkup"/>
            </div>
        </div>
    `;
    static props = {
        pointerState: {
            type: Object,
            shape: {
                x: Number,
                y: Number,
                isVisible: Boolean,
                position: {
                    validate: (p) => ["top", "bottom", "left", "right"].includes(p),
                },
                content: { type: String, optional: true },
                /**
                 * "bubble": Just the pointer.
                 * "info": The pointer becomes a callout showing the [content].
                 */
                mode: {
                    validate: (m) => ["bubble", "info"].includes(m),
                },
                /**
                 * Whether this component should be { display: "fixed" }.
                 */
                fixed: Boolean,
            },
        },
        setPointerState: Function,
    };
    setup() {
        this.tooltipRef = useRef("tooltip-ref");
        this.state = useState({ height: false });
        onPatched(() => {
            const width = this.tooltipRef.el.offsetWidth;
            if (width > 270) {
                this.tooltipRef.el.style.width = "270px";
            }
        });
    }
    get extraClasses() {
        return {
            [this.props.pointerState.mode === "bubble" ? "o_animated" : "active"]: true,

            // TODO-JCB: Should be removed.
            o_tooltip_visible: this.props.pointerState.isVisible,

            [this.props.pointerState.position]: true,
            o_tooltip_fixed: this.props.pointerState.fixed,
        };
    }
    get contentMarkup() {
        return this.props.pointerState.mode == "info" && this.props.pointerState.content
            ? markup(this.props.pointerState.content)
            : "";
    }
    get style() {
        return Object.entries({
            top: `${this.props.pointerState.y}px`,
            left: `${this.props.pointerState.x}px`,
            // Force the width when in bubble mode.
            width: this.props.pointerState.mode === "bubble" && "28px",
        })
            .filter(([, v]) => v)
            .map(([k, v]) => `${k}:${v}`)
            .join(";");
    }
}
