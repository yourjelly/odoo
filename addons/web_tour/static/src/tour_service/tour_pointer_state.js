/** @odoo-module **/

import { reactive } from "@odoo/owl";
import { TourPointer } from "../tour_pointer/tour_pointer";

/**
 * @typedef {"left" | "right" | "top" | "bottom"} Position
 *
 * @typedef TourPointerState
 * @property {string} [content]
 * @property {boolean} fixed
 * @property {boolean} [isOpen]
 * @property {boolean} isVisible
 * @property {Position} position
 * @property {number} x
 * @property {number} y
 */

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
 * @param {Partial<TourPointerState>} params
 */
export function createPointerState({ x, y, isVisible, position, content, isOpen, fixed }) {
    // TODO-JCB: Take into account the rtl config.
    /**
     * @param {Element} el
     * @param {Position} position
     * @returns {[number, number]}
     */
    const computeLocation = (el, position) => {
        const rect = el.getBoundingClientRect();
        let { left, top } = rect;
        switch (position) {
            case "left": {
                left -= TourPointer.size;
                top += rect.height / 2 - TourPointer.size / 2;
                break;
            }
            case "right": {
                left += rect.width;
                top += rect.height / 2 - TourPointer.size / 2;
                break;
            }
            case "top": {
                left += rect.width / 2 - TourPointer.size / 2;
                top -= TourPointer.size;
                break;
            }
            case "bottom": {
                left += rect.width / 2 - TourPointer.size / 2;
                top += rect.height;
                break;
            }
        }
        return [top, left];
    };

    /**
     * @param {Partial<TourPointerState>} newState
     */
    const setState = (newState) => {
        Object.assign(state, newState);
    };

    /**
     * @param {Step?} step
     * @param {Element} [anchor]
     */
    const update = (step, anchor) => {
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
                    y = intersection.rootBounds.height - 80 - TourPointer.size;
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
    };

    /** @type {TourPointerState} */
    const state = reactive({ x, y, isVisible, position, content, isOpen, fixed });
    const intersection = new Intersection();

    return [state, { setState, update }];
}
