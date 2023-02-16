/** @odoo-module **/

import { reactive } from "@odoo/owl";

/**
 * @typedef {import("@web/core/position_hook").Direction} Direction
 *
 * @typedef {"in" | "out-below" | "out-above" | "unknown"} IntersectionPosition
 *
 * @typedef {import("./tour_service").TourStep} TourStep
 *
 * @typedef TourPointerState
 * @property {HTMLElement} [anchor]
 * @property {string} [content]
 * @property {boolean} fixed
 * @property {boolean} [isOpen]
 * @property {boolean} isVisible
 * @property {Direction} position
 */

class Intersection {
    constructor() {
        /** @type {Element | null} */
        this.currentTarget = null;
        this.rootBounds = null;
        /** @type {IntersectionPosition} */
        this._targetPosition = "unknown";
        this._observer = new IntersectionObserver((observations) =>
            this._handleObservations(observations)
        );
    }

    /** @type {IntersectionObserverCallback} */
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

export function createPointerState() {
    /**
     * @param {Partial<TourPointerState>} newState
     */
    const setState = (newState) => {
        Object.assign(state, newState);
    };

    /**
     * @param {TourStep} step
     * @param {HTMLElement} [anchor]
     */
    const update = (step, anchor) => {
        intersection.setTarget(anchor);
        if (anchor) {
            switch (intersection.targetPosition) {
                case "unknown": {
                    // TODO-JCB: Maybe this targetPosition value is not needed.
                    console.warn("Something's wrong on the `Intersection` instance.");
                    break;
                }
                case "in": {
                    setState({
                        anchor,
                        content: step.content,
                        position: step.position,
                    });
                    break;
                }
                default: {
                    // TODO-JUM: give root element instead of position
                    // let x = intersection.rootBounds.width / 2;
                    // let y, position, content;
                    // if (intersection.targetPosition === "out-below") {
                    //     y = intersection.rootBounds.height - 80 - TourPointer.height;
                    //     position = "top";
                    //     content = "Scroll down to reach the next step.";
                    // } else if (intersection.targetPosition === "out-above") {
                    //     y = 80;
                    //     position = "bottom";
                    //     content = "Scroll up to reach the next step.";
                    // }
                    // setState({ x, y, content, position });
                }
            }
        } else {
            setState({ isVisible: false });
        }
    };

    /** @type {TourPointerState} */
    const state = reactive({});
    const intersection = new Intersection();

    return [state, { setState, update }];
}
