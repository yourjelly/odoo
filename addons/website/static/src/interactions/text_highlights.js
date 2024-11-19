import { Interaction } from "@website/core/interaction";
import { registry } from "@web/core/registry";
import {
    applyTextHighlight,
    removeTextHighlight,
    switchTextHighlight,
} from "@website/js/text_processing";

class TextHighlight extends Interaction {
    static selector = '#wrapwrap'

    setup() {
        this.observerLock = new Map();
        this.resizeObserver = new window.ResizeObserver(entries => {
            if (this.isDestroyed) {
                return;
            }
            window.requestAnimationFrame(() => {
                const textHighlightEls = new Set();
                entries.forEach(entry => {
                    const target = entry.target;
                    if (this.observerLock.get(target)) {
                        return this.observerLock.set(target, false);
                    }
                    const topTextEl = target.closest(".o_text_highlight");
                    for (const el of topTextEl ? [topTextEl]
                        : target.querySelectorAll(":scope .o_text_highlight")
                    ) {
                        textHighlightEls.add(el);
                    }
                });
                textHighlightEls.forEach(textHighlightEl => {
                    for (const textHighlightItemEl of this.getTextHighlightItems(textHighlightEl)) {
                        this.resizeObserver.unobserve(textHighlightItemEl);
                    }
                    switchTextHighlight(textHighlightEl);
                });
            });
        });
        this.onTextHighlightAddedBound = this.onTextHighlightAdded.bind(this);
        this.onTextHighlightRemovedBound = this.onTextHighlightRemoved.bind(this)
    }

    start() {
        this.el.addEventListener("text_highlight_added", this.onTextHighlightAddedBound);
        this.el.addEventListener("text_highlight_remove", this.onTextHighlightRemovedBound);
        for (const textEl of this.el.querySelectorAll(".o_text_highlight")) {
            applyTextHighlight(textEl);
        }
    }

    destroy() {
        this.el.removeEventListener("text_highlight_added", this.onTextHighlightAddedBound);
        this.el.removeEventListener("text_highlight_remove", this.onTextHighlightRemovedBound);
        for (const textHighlightEl of this.el.querySelectorAll(".o_text_highlight")) {
            removeTextHighlight(textHighlightEl);
        }
    }

    /**
     * @param {HTMLElement} el
     */
    closestToObserve(el) {
        if (el === this.el || !el) {
            return null;
        }
        if (window.getComputedStyle(el).display !== "inline") {
            return el;
        }
        return this.closestToObserve(el.parentElement);
    }

    /**
     * @param {HTMLElement} el
     */
    getTextHighlightItems(el = this.el) {
        return el.querySelectorAll(":scope .o_text_highlight_item");
    }

    /**
     * @param {HTMLElement} topTextEl
     */
    getObservedEls(topTextEl) {
        const closestToObserve = this.closestToObserve(topTextEl);
        return [
            ...(closestToObserve ? [closestToObserve] : []),
            ...this.getTextHighlightItems(topTextEl),
        ]
    }

    /**
     * @param {HTMLElement} topTextEl
     * be observed.
     */
    observeTextHighlightResize(topTextEl) {
        // The `ResizeObserver` cannot detect the width change on highlight
        // units (`.o_text_highlight_item`) as long as the width of the entire
        // `.o_text_highlight` element remains the same, so we need to observe
        // each one of them and do the adjustment only once for the whole text.
        for (const highlightItemEl of this.getObservedEls(topTextEl)) {
            this.resizeObserver.observe(highlightItemEl);
        }
    }

    /**
     * @param {HTMLElement} topTextEl
     */
    lockTextHighlightObserver(topTextEl) {
        for (const targetEl of this.getObservedEls(topTextEl)) {
            this.observerLock.set(targetEl, true);
        }
    }

    /**
     * @param {Event} ev
     */
    onTextHighlightAdded(ev) {
        this.lockTextHighlightObserver(ev.target);
        this.observeTextHighlightResize(ev.target);
    }

    /**
     * @param {Event} ev
     */
    onTextHighlightRemoved(ev) {
        for (const highlightItemEl of this.getTextHighlightItems(ev.target)) {
            this.observerLock.delete(highlightItemEl);
        }
    }
}

registry
    .category("website.active_elements")
    .add("website.text_highlight", TextHighlight);
