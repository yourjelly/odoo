import { BaseHeader } from "./base_header";

export class BaseHeaderSpecial extends BaseHeader {
    dynamicContent = {
        ...this.dynamicContent,
        ".o_header_hide_on_scroll .dropdown-toggle": {
            "t-on-show.bs.dropdown": this.onDropdownShow,
        },
        ".o_header_hide_on_scroll :not(.modal-content) > .o_searchbar_form": {
            "t-on-input": this.onSearchbarInput,
        },
    }

    setup() {
        super.setup();

        this.currentPosition = 0;
        this.scrollOffsetLimit = 200;
        this.scrollingDownwards = true;

        this.searchbarEl = this.hiddenOnScrolleEl?.querySelector(":not(.modal-content) > .o_searchbar_form");
    }

    start() {
        super.start();

        this.onScroll();
    }

    destroy() {
        super.destroy();
        if (this.isAnimated) {
            this.showHeader();
        }
    }

    showHeader() {
        this.isHidden = false;
        this.el.dispatchEvent(new Event("odoo-transitionstart"));
    }

    hideHeader() {
        this.isHidden = true;
        this.el.dispatchEvent(new Event("odoo-transitionstart"));
    }

    /**
     * @param {Event} ev
     */
    onDropdownShow(ev) {
        // If a dropdown inside the element 'this.hiddenOnScrollEl' is clicked
        // while the header is fixed, we need to scroll the page up so that the
        // 'this.hiddenOnScrollEl' element is no longer overflow hidden. Without
        // this, the dropdown would be invisible.
        if (!this.isFixed) {
            return;
        }
        ev.preventDefault();
        this.dropdownClickedEl = ev.currentTarget;
        document.scrollingElement.scrollTo({ top: 0, behavior: "smooth" });
    }

    onSearchbarInput() {
        // Prevents the dropdown with search results from being hidden when the
        // header is fixed (see comment in '_onDropdownClick').
        // The scroll animation is instantaneous because the dropdown could open
        // before reaching the top of the page, which would result in an
        // incorrect calculated height of the header.
        if (!this.isFixed) {
            return;
        }
        document.scrollingElement.scrollTo({ top: 0 });
    }

    /**
     * @param {integer} scroll
     */
    onScrollAnimated(scroll) {
        const scrollingDownwards = (scroll > this.currentPosition);
        if (scrollingDownwards !== this.scrollingDownwards) {
            this.checkPoint = scroll;
        }

        this.currentPosition = scroll;
        this.scrollingDownwards = scrollingDownwards;

        if (scrollingDownwards) {
            if (!this.isHidden && scroll - this.checkPoint > this.scrollOffsetLimit) {
                this.hideHeader();
            }
        } else {
            if (this.isHidden && scroll - this.checkPoint < - this.scrollOffsetLimit / 2) {
                this.showHeader();
            }
        }
    }

    onScroll() {
        super.onScroll();
        console.log("hey");
        const scroll = document.scrollingElement.scrollTop;

        if (scroll > this.scrolledPoint) {
            if (!this.el.classList.contains('o_header_affixed')) {
                this.el.style.transform = `translate(0, 0)`;
                void this.el.offsetWidth; // Force a paint refresh
                this.toggleFixedBehavior(true);
            }
        } else {
            this.toggleFixedBehavior(false);
            void this.el.offsetWidth; // Force a paint refresh
            this.el.style.transform = '';
        }

        if (this.hiddenOnScrollEl) {
            if (this.isFixed && this.searchbarEl?.matches(".show")) {
                // Close the dropdown of the search bar if it's open when
                // scrolling. Otherwise, the calculated height of the
                // 'hiddenOnScrollEl' element will be incorrect because it will
                // include the dropdown height.
                this.searchbarEl.querySelector("input").blur();
            }
            const scrollDelta = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches ?
                scroll : Math.floor(scroll / 4);

            const elHeight = Math.max(0, this.hiddenOnScrollEl.scrollHeight - scrollDelta)
            if (elHeight === 0) {
                this.hiddenOnScrollEl.classList.add("hidden");
                this.hiddenOnScrollEl.removeAttribute("style");
            } else {
                // When the page hasn't been scrolled yet, we don't set overflow
                // to hidden. Without this, the dropdowns would be invisible.
                // (e.g., "user menu" dropdown).
                this.hiddenOnScrollEl.classList.remove("hidden");
                this.hiddenOnScrollEl.style.overflow = this.isFixed ? "hidden" : "";
                this.hiddenOnScrollEl.style.height = this.isFixed ? `${elHeight}px` : "";
                let elPadding = parseInt(getComputedStyle(this.hiddenOnScrollEl).paddingBlock);
                if (elHeight < elPadding * 2) {
                    const heightDifference = elPadding * 2 - elHeight;
                    elPadding = Math.max(0, elPadding - Math.floor(heightDifference / 2));
                    this.hiddenOnScrollEl.style
                        .setProperty("padding-block", `${elPadding}px`, "important");
                } else {
                    this.hiddenOnScrollEl.style.paddingBlock = "";
                }
                if (this.isFixed) {
                    // The height of the "hiddenOnScrollEl" element changes, so
                    // the height of the header also changes. Therefore, we need
                    // to get the current height of the header and then to
                    // update the top padding of the main element.
                    this.adjustMainPaddingTop();
                }
            }
            if (!this.isFixed && this.dropdownClickedEl) {
                const dropdown = Dropdown.getOrCreateInstance(this.dropdownClickedEl);
                dropdown.show();
                this.dropdownClickedEl = null;
            }
        }

        if (this.isAnimated) {
            this.onScrollAnimated(scroll);
        }
    }
}
