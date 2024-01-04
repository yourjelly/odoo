/** @odoo-module **/

import { Component, useEffect, onWillDestroy, useRef, onMounted } from "@odoo/owl";
import { useForwardRefToParent } from "../utils/hooks";
import { usePosition } from "@web/core/position/position_hook";
import { addClassesToElement, mergeClasses } from "../utils/className";
import { uniqueId } from "@web/core/utils/functions";
import { useActiveElement } from "@web/core/ui/ui_service";

export class Popover extends Component {
    static template = "web.PopoverWowl";
    static defaultProps = {
        position: "bottom",
        class: "",
        fixedPosition: false,
        arrow: true,
        animation: true,
        setActiveElement: false,
    };
    static props = {
        ref: {
            type: Function,
            optional: true,
        },
        class: {
            optional: true,
        },
        role: {
            optional: true,
            type: String,
        },
        position: {
            type: String,
            validate: (p) => {
                const [d, v = "middle"] = p.split("-");
                return (
                    ["top", "bottom", "left", "right"].includes(d) &&
                    ["start", "middle", "end", "fit"].includes(v)
                );
            },
            optional: true,
        },
        onPositioned: {
            type: Function,
            optional: true,
        },
        fixedPosition: {
            type: Boolean,
            optional: true,
        },
        holdOnHover: {
            type: Boolean,
            optional: true,
        },
        arrow: {
            type: Boolean,
            optional: true,
        },
        animation: {
            type: Boolean,
            optional: true,
        },
        setActiveElement: {
            type: Boolean,
            optional: true,
        },
        target: {
            validate: (target) => {
                // target may be inside an iframe, so get the Element constructor
                // to test against from its owner document's default view
                const Element = target?.ownerDocument?.defaultView.Element;
                return (
                    Boolean(Element) &&
                    (target instanceof Element || target instanceof window.Element)
                );
            },
        },
        slots: {
            type: Object,
            optional: true,
            shape: {
                default: { optional: true },
            },
        },
    };

    static animationTime = 200;
    setup() {
        this.menuRef = useRef("ref");
        this.arrow = useRef("popoverArrow");

        if (this.props.setActiveElement) {
            useActiveElement("ref");
        }

        useForwardRefToParent("ref");
        this.shouldAnimate = this.props.animation;
        this.position = usePosition("ref", () => this.props.target, {
            onPositioned: this.onPositioned.bind(this),
            position: this.props.position,
        });

        if (this.props.holdOnHover) {
            const lock = () => this.position.lock();
            const unlock = () => this.position.unlock();

            useEffect(
                () => {
                    this.menuRef.el.addEventListener("pointerenter", lock);
                    this.menuRef.el.addEventListener("pointerleave", unlock);

                    return () => {
                        this.menuRef.el.removeEventListener("pointerenter", lock);
                        this.menuRef.el.removeEventListener("pointerleave", unlock);
                    };
                },
                () => [this.menuRef.el]
            );
        }

        onMounted(() => {
            const id = uniqueId("popover-");
            this.menuRef.el.setAttribute("data-popover-id", id);
            this.props.target.setAttribute("data-popover-for", id);
        });

        onWillDestroy(() => {
            this.props.target?.removeAttribute("data-popover-for");
        });
    }

    get defaultClassObj() {
        return mergeClasses("o_popover popover mw-100 shadow", this.props.class);
    }

    onPositioned(el, solution) {
        const { direction, variant } = solution;
        const position = `${direction[0]}${variant[0]}`;

        // reset all popover classes
        el.classList = [];
        const directionMap = {
            top: "top",
            bottom: "bottom",
            left: "start",
            right: "end",
        };
        addClassesToElement(
            el,
            this.defaultClassObj,
            `bs-popover-${directionMap[direction]}`,
            `o-popover-${direction}`,
            `o-popover--${position}`
        );

        if (this.props.arrow) {
            const arrowEl = this.arrow.el;
            // reset all arrow classes
            arrowEl.className = "popover-arrow";
            switch (position) {
                case "tm": // top-middle
                case "bm": // bottom-middle
                case "tf": // top-fit
                case "bf": // bottom-fit
                    arrowEl.classList.add("start-0", "end-0", "mx-auto");
                    break;
                case "lm": // left-middle
                case "rm": // right-middle
                case "lf": // left-fit
                case "rf": // right-fit
                    arrowEl.classList.add("top-0", "bottom-0", "my-auto");
                    break;
                case "ts": // top-start
                case "bs": // bottom-start
                    arrowEl.classList.add("end-auto");
                    break;
                case "te": // top-end
                case "be": // bottom-end
                    arrowEl.classList.add("start-auto");
                    break;
                case "ls": // left-start
                case "rs": // right-start
                    arrowEl.classList.add("bottom-auto");
                    break;
                case "le": // left-end
                case "re": // right-end
                    arrowEl.classList.add("top-auto");
                    break;
            }
        }

        // opening animation
        if (this.shouldAnimate) {
            this.shouldAnimate = false; // animate only once
            const transform = {
                top: ["translateY(-5%)", "translateY(0)"],
                right: ["translateX(5%)", "translateX(0)"],
                bottom: ["translateY(5%)", "translateY(0)"],
                left: ["translateX(-5%)", "translateX(0)"],
            }[direction];
            this.position.lock();
            const animation = el.animate(
                { opacity: [0, 1], transform },
                {
                    duration: this.constructor.animationTime,
                    easing: "cubic-bezier(0.215, 0.610, 0.355, 1.000)",
                }
            );
            animation.finished.then(this.position.unlock);
        }

        if (this.props.fixedPosition) {
            // Prevent further positioning updates if fixed position is wanted
            this.position.lock();
        }

        this.props.onPositioned?.(el, solution);
    }
}
