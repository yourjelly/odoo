/* @odoo-module */

import { reactive } from "@odoo/owl";

class Intersection {
    constructor() {
        this.currentTarget = null;
        this.rootBounds = null;
        this._targetPosition = "unknown";
        this._observer = new IntersectionObserver((observations) =>
            this._handleObservations(observations)
        );
    }
    _handleObservations(observations) {
        if (observations.length < 1) {
            return;
        }
        const observation = observations[observations.length - 1];
        this.rootBounds = observation.rootBounds;
        if (this.rootBounds && this.currentTarget) {
            if (observation.isIntersecting) {
                this._targetPosition = "in";
            } else {
                const targetBounds = this.currentTarget.getBoundingClientRect();
                if (targetBounds.bottom < this.rootBounds.height / 2) {
                    this._targetPosition = "out-above";
                } else if (targetBounds.top > this.rootBounds.height / 2) {
                    this._targetPosition = "out-below";
                }
            }
        } else {
            this._targetPosition = "unknown";
        }
    }
    /**
     * @returns {'in' | 'out-below' | 'out-above' | 'unknown'}
     */
    get targetPosition() {
        if (!this.rootBounds) {
            return this.currentTarget ? "in" : "unknown";
        } else {
            return this._targetPosition;
        }
    }
    /**
     * @param {Element} newTarget
     */
    setTarget(newTarget) {
        if (this.currentTarget !== newTarget) {
            if (this.currentTarget) {
                this._observer.unobserve(this.currentTarget);
            }
            if (newTarget) {
                this._observer.observe(newTarget);
            }
            this.currentTarget = newTarget;
        }
    }
    stop() {
        this._observer.disconnect();
    }
}

/**
 * @param {*} param0
 * @returns {[state: { x, y, isVisible, position, content, mode }, methods: { update, setState }]}
 */
export function createPointerState({ x, y, isVisible, position, content, mode, fixed }) {
    const intersection = new Intersection();
    const state = reactive({ x, y, isVisible, position, content, mode, fixed });
    const pointerSize = { width: 28, height: 28 };

    // TODO-JCB: Take into account the rtl config.
    function computeLocation(el, position) {
        let top, left;
        const rect = el.getBoundingClientRect();
        if (position == "top") {
            top = rect.top - pointerSize.height;
            left = rect.left + rect.width / 2 - pointerSize.width / 2;
        } else if (position == "bottom") {
            top = rect.top + rect.height;
            left = rect.left + rect.width / 2 - pointerSize.width / 2;
        } else if (position == "left") {
            top = rect.top + rect.height / 2 - pointerSize.height / 2;
            left = rect.left;
        } else if (position == "right") {
            top = rect.top + rect.height / 2 - pointerSize.height / 2;
            left = rect.left + rect.width;
        }
        return [top, left];
    }

    function update(step, anchor) {
        intersection.setTarget(anchor);
        if (anchor) {
            if (intersection.targetPosition === "unknown") {
                // TODO-JCB: Maybe this targetPosition value is not needed.
                console.warn("Something's wrong on the `Intersection` instance.");
            } else if (intersection.targetPosition === "in") {
                const position = step.position || "top";
                const [top, left] = computeLocation(anchor, position);
                setState({
                    x: left,
                    y: top,
                    content: step.content || "",
                    position,
                });
            } else {
                let x = intersection.rootBounds.width / 2;
                let y, position, content;
                if (intersection.targetPosition === "out-below") {
                    y = intersection.rootBounds.height - 80 - 28;
                    position = "top";
                    content = "Scroll down to reach the next step.";
                } else if (intersection.targetPosition === "out-above") {
                    y = 80;
                    position = "bottom";
                    content = "Scroll up to reach the next step.";
                }
                setState({ x, y, content, position });
            }
        } else {
            setState({ isVisible: false });
        }
    }

    function setState(obj) {
        Object.assign(state, obj);
    }

    return [state, { update, setState }];
}
