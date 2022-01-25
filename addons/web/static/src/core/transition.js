/* @odoo-module */

import { browser } from "@web/core/browser/browser";

const { Component, xml, useState, onWillUpdateProps, useEffect, onWillUnmount } = owl;

//
// First, a bunch of quite generic helpers to DIY around owl2's API
//

const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Get all root HTMLElement from a given bdom (owl blockdom)
 * It is recursive
 * @param  {owl.VNode} bdom
 * @return {HTMLElement[]}
 */
function getNodes(bdom) {
    const nodes = [];
    if (!bdom) {
        return nodes;
    }
    if (hasOwnProperty.call(bdom, "component")) {
        nodes.push(...getNodes(bdom.bdom));
    } else if (bdom.el) {
        nodes.push(bdom.el);
    } else if (hasOwnProperty.call(bdom, "children")) {
        for (const bnode of bdom.children) {
            nodes.push(...getNodes(bnode));
        }
    } else if (hasOwnProperty.call(bdom, "child")) {
        nodes.push(...getNodes(bdom.child));
    }
    return nodes;
}

/**
 * Create a owl Ref (similar to what useRef returns).
 * The el resolves to the return of the getEl callback
 * @param  {() => EventTarget}
 * @return {{el: EventTarget}}
 */
function useOwlRef(getEl) {
    let el;
    useEffect(() => {
        el = getEl();
    });
    return {
        get el() {
            return el;
        }
    };
}

/**
 * Allows to attach an event listener on an arbitrary owl ref (created with useRef)
 * @param  {{el: EventTarget | null}} owlRef   [description]
 * @param  {string} evName   the event name
 * @param  {() => void} listener the event handler
 */
function useRefListener(owlRef, evName, listener) {
    let el = null;

    useEffect(() => {
        const newEl = owlRef.el;
        if (el !== newEl) {
            if (el) {
                el.removeEventListener(evName, listener);
            }
            if (newEl) {
                newEl.addEventListener(evName, listener);
            }
        }
        el = newEl;
    });
    onWillUnmount(() => {
        el.removeEventListener(evName, listener);
    });
}

//
// Then, the real Business: a implementation of a HOC to support css transitions
//

const transitionClasses = [
    "enter", "enter-active", "enter-to",
    "leave", "leave-active", "leave-to",
];

function makeClasses(name) {
    const cls = {};
    for (const cl of transitionClasses) {
        cls[cl] =  `${name}-${cl}`;
    }
    return cls;
}

export class Transition extends Component {

    setup() {
        //
        // Basic Setup
        //
        this.transitionClasses = makeClasses(this.props.name);
        const state = useState({ isVisible: this.props.isVisible });
        this.state = state;

        //
        // Handle transitionend event
        //
        const targets = [];
        let transitionEventTimeout;
        const transitionsEnd = (ev) => {
            const target = ev.target;
            if (!(this.children.includes(target))) {
                return;
            }
            targets.push(target);
            browser.clearTimeout(transitionEventTimeout);
            transitionEventTimeout = browser.setTimeout(() => {
                if (willLeave) {
                    state.isVisible = false;
                } else {
                    this.cleanChildrenClasses(targets);
                }
                targets.length = 0;
            });
        };

        const parentRef = useOwlRef(() => this.__owl__.bdom.parentEl);
        useRefListener(parentRef, "transitionend", transitionsEnd);

        //
        // The real Business: intercept changes in the state
        // - Immediately render when we are switching to visible.
        // - Delay the change of state if we closing (transitionend should make us not visible)
        //
        let willLeave = false;
        let hasChanged;
        onWillUpdateProps(nextProps => {
            hasChanged = (
                (state.isVisible !== nextProps.isVisible) ||
                (willLeave && nextProps.isVisible)
            );
            if (!hasChanged) {
                return;
            }
            this.clearTimeouts();
            if (!nextProps.isVisible) {
                willLeave = true;
            } else {
                willLeave = false;
                state.isVisible = true;
            }
        });

        useEffect(() => {
            if (!state.isVisible || hasChanged === false) {
                return;
            }

            this.clearTimeouts();
            this.children = this.getChildren();
            if (!willLeave) {
                this.setTransition(this.children, "enter");
                this.enterTransition(this.children);
            } else {
                this.setTransition(this.children, "leave");
                this.enterTransition(this.children, "leave");
                this.leavingTimeout();
            }
        }, ()=>[this.state.isVisible, hasChanged, willLeave]);
    }

    getChildren() {
        return getNodes(this.__owl__.bdom).filter((el) => el instanceof HTMLElement);
    }

    /**
     * Apply the classes at the instant 0 of a transition when just appended in DOM.
     * @param {HTMLElement[]} children
     * @param {"enter" | "leave"} [type] whether entering or leaving classes should be applied
     */
    setTransition(children, type = "enter") {
       const classes =  this.transitionClasses;

       // classes to add
       const classType = classes[type];
       const active =classes[`${type}-active`];

       // classes to remove
       const rmType = type === "enter" ? "leave" : "enter";
       const rmTypeClass = classes[rmType];
       const rmActive = classes[`${rmType}-active`];

       for (const current of children) {
           const classList = current.classList;
           classList.add(classType);
           classList.add(active);
           classList.remove(rmTypeClass);
           classList.remove(rmActive);
       }
    }

    /**
     * Apply the classes that will animate the transition, done in the next Frame after the patch
     * @param {HTMLElement[]} children
     * @param {"enter" | "leave"} [type] whether entering or leaving classes should be applied
     */
    enterTransition(children, type = "enter") {
        this.frameRequestId = browser.requestAnimationFrame(() => {
           const classes =  this.transitionClasses;
           const classType = classes[type];
           const to = classes[`${type}-to`];

           for (const current of children) {
               current.classList.remove(classType);
               current.classList.add(to);
           }
        });
    }

    /**
     * When we are leaving, our state still has not changed. This function ensures
     * that the state will change to not visible at some point
     */
    leavingTimeout() {
        this.leavingTimeout = browser.setTimeout(() => {
            this.state.isVisible = false;
        }, this.props.maxLeavingTimeout);
    }

    /**
     * clears every timeout launched in a previous cycle
     */
    clearTimeouts() {
        browser.cancelAnimationFrame(this.frameRequestId);
        browser.clearTimeout(this.leavingTimeout);
    }

    /**
     * At the end of a cycle, delete every class used for transitions
     * @param  {HTMLElement[]} children [description]
     */
    cleanChildrenClasses(children) {
        for (const elm of children) {
            for (const cls of Object.values(this.transitionClasses)) {
                elm.classList.remove(cls);
            }
        }
    }
}
Transition.template = xml`<t t-if="state.isVisible"><t t-slot="default" /></t>`;
Transition.defaultProps = {
    maxLeavingTimeout: 500,
};
