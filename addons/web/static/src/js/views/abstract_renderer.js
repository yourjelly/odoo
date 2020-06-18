odoo.define('web.AbstractRenderer', function (require) {
"use strict";

/**
 * The renderer should not handle pagination, data loading, or coordination
 * with the control panel. It is only concerned with rendering.
 *
 */

var mvc = require('web.mvc');

const FOCUSABLE_ELEMENTS = [
    ':scope a',
    ':scope button',
    ':scope input',
    ':scope textarea',
    ':scope *[tabindex="0"]'
].join(', ');

/**
 * @param {Event} ev
 */
function cancelEvent(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
}

/**
 * @class AbstractRenderer
 */
return mvc.Renderer.extend({
    sampleDataTargets: [],

    /**
     * @override
     * @param {string} [params.noContentHelp]
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.arch = params.arch;
        this.noContentHelp = params.noContentHelp;
        this.withSearchPanel = params.withSearchPanel;
        this.removeSampleModifiers = null;
    },
    /**
     * The rendering is asynchronous. The start
     * method simply makes sure that we render the view.
     *
     * @returns {Promise}
     */
    async start() {
        this.$el.addClass(this.arch.attrs.class);
        if (this.withSearchPanel) {
            this.$el.addClass('o_renderer_with_searchpanel');
        }
        await Promise.all([this._render(), this._super()]);
        this._toggleSampleData();
    },
    /**
     * Called each time the renderer is attached into the DOM.
     */
    on_attach_callback: function () {},
    /**
     * Called each time the renderer is detached from the DOM.
     */
    on_detach_callback: function () {},

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Returns any relevant state that the renderer might want to keep.
     *
     * The idea is that a renderer can be destroyed, then be replaced by another
     * one instantiated with the state from the model and the localState from
     * the renderer, and the end result should be the same.
     *
     * The kind of state that we expect the renderer to have is mostly DOM state
     * such as the scroll position, the currently active tab page, ...
     *
     * This method is called before each updateState, by the controller.
     *
     * @see setLocalState
     * @returns {any}
     */
    getLocalState: function () {
    },
    /**
     * Order to focus to be given to the content of the current view
     */
    giveFocus: function () {
    },
    /**
     * This is the reverse operation from getLocalState.  With this method, we
     * expect the renderer to restore all DOM state, if it is relevant.
     *
     * This method is called after each updateState, by the controller.
     *
     * @see getLocalState
     * @param {any} localState the result of a call to getLocalState
     */
    setLocalState: function (localState) {
    },
    /**
     * Updates the state of the view. It retriggers a full rerender, unless told
     * otherwise (for optimization for example).
     *
     * @param {any} state
     * @param {Object} params
     * @param {boolean} [params.noRender=false]
     *        if true, the method only updates the state without rerendering
     * @returns {Promise}
     */
    async updateState(state, params) {
        this._setState(state);
        if (!params.noRender) {
            await this._render();
            this._toggleSampleData();
        }
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Render the view
     *
     * @abstract
     * @private
     * @returns {Promise}
     */
    _render: function () {
        return Promise.resolve();
    },
    /**
     * Assigns a new state to the renderer if not false.
     *
     * @private
     * @param {any} [state=false]
     */
    _setState(state = false) {
        if (state !== false) {
            this.state = state;
        }
    },
    /**
     * POC
     *
     * In this function:
     * - any event registered in the 'events' object will be prevented on all
     * elements matching one of the selectors in the 'sampleDataTargets' object
     * - any focusable element in these selected targets will be disabled by
     * setting their 'tabindex' attribute to -1
     *
     * @private
     */
    _toggleSampleData() {
        if (this.removeSampleModifiers) {
            this.removeSampleModifiers();
        }
        if (this.state.isSample) {
            const events = new Set();
            for (const event in this.events) {
                const eventName = event.split(/ /)[0];
                events.add(eventName);
            }
            const rootEls = [];
            for (const selector of this.sampleDataTargets) {
                rootEls.push(...this.el.querySelectorAll(':scope ' + selector));
            }
            const focusableEls = new Set();
            for (const root of rootEls) {
                // Add event listeners
                for (const event of events) {
                    root.addEventListener(event, cancelEvent, true);
                }
                focusableEls.add(root);
                for (const focusableEl of root.querySelectorAll(FOCUSABLE_ELEMENTS)) {
                    focusableEls.add(focusableEl);
                }
            }
            // Suppress tab indices
            const originalTabindices = [];
            focusableEls.forEach((focusableEl, i) => {
                originalTabindices[i] = focusableEl.tabindex;
                focusableEl.setAttribute('tabindex', -1);
            });
            this.removeSampleModifiers = () => {
                // Remove event listeners
                for (const root of rootEls) {
                    for (const event of events) {
                        root.removeEventListener(event, cancelEvent, true);
                    }
                }
                // Restore tab indices
                focusableEls.forEach((focusableEl, i) => {
                    focusableEl.setAttribute('tabindex', originalTabindices[i]);
                });
            };
        } else {
            this.removeSampleModifiers = null;
        }
    },
});

});
