import { Interaction } from "@website/core/interaction";
import { SIZES, utils as uiUtils } from "@web/core/ui/ui_service";
import { compensateScrollbar } from "@web/core/utils/scrolling";

const disableScroll = function () {
    if (uiUtils.getSize() < SIZES.LG) {
        document.body.classList.add('overflow-hidden');
    }
};

const enableScroll = function () {
    document.body.classList.remove('overflow-hidden');
};

// TODO
export class BaseHeader extends Interaction {
    dynamicContent = {
        _document: {
            "t-on-scroll": this.onScroll,
        },
        _window: {
            "t-on-resize": this.onResize,
        },
        _root: {
            "t-on-odoo-transitionstart": this.onTransitionStart,
            "t-on-transitionend": this.onTransitionEnd,
        },
        ".offcanvas": {
            "t-on-show.bs.offcanvas": disableScroll,
            "t-on-hide.bs.offcanvas": enableScroll,
        },
        ".navbar-collapse": {
            "t-on-show.bs.collapse": disableScroll,
            "t-on-hide.bs.collapse": enableScroll,
        }
    }

    setup() {
        this.isFixed = false;
        this.isHidden = false;
        this.isAnimated = false;

        this.isOverlay = !!this.el.closest(".o_header_overlay, .o_header_overlay_theme");

        this.scrolledPoint = 0;
        this.isScrolled = false;
        this.wasScrolled = false;
        this.canBeScrolled = false;

        this.closeMenus = false;

        this.main = this.el.parentElement.querySelector("main");
        this.hiddenOnScrolleEl = this.el.querySelector(".o_header_hide_on_scroll");

        this.transitionCount = 0;

    }

    destroy() {
        this.toggleFixedBehavior(false);
        console.log("destroy");
    }

    onTransitionStart() {
        this.el.classList.add('o_transitioning');
        this.adaptToHeaderChangeLoop(1);
    }

    onTransitionEnd() {
        this.adaptToHeaderChangeLoop(-1);
    }

    adaptToHeaderChange() {
        // this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerUnactive();
        this.adjustMainPaddingTop();
        // Take menu into account when `scrollTo()` is used whenever it is
        // visible - be it floating, fully displayed or partially hidden.
        this.el.classList.toggle('o_top_fixed_element', this.isVisible());
        // for (const callback of extraMenuUpdateCallbacks) {
        //     callback();
        // }
        // this.options.wysiwyg && this.options.wysiwyg.odooEditor.observerActive();
    }

    /**
     * @param {integer} addCount
     */
    adaptToHeaderChangeLoop(addCount) {
        this.adaptToHeaderChange();
        this.transitionCount = Math.max(0, this.transitionCount + addCount);
        // As long as we detected a transition start without its related
        // transition end, keep updating the main padding top.
        if (this.transitionCount > 0) {
            window.requestAnimationFrame(() => this.adaptToHeaderChangeLoop());
            if (addCount !== 0) {
                clearTimeout(this.changeLoopTimer);
                this.changeLoopTimer = setTimeout(() => {
                    this.adaptToHeaderChangeLoop(-this.transitionCount);
                }, 500);
            }
        } else {
            clearTimeout(this.changeLoopTimer);
            this.el.classList.remove('o_transitioning');
        }
    }

    adjustURLAutoScroll() {
        // When the url contains #aRandomSection, prevent the navbar to overlap
        // on the section, for this, we scroll as many px as the navbar height.
        if (!this.editableMode) {
            return;
        }
        document.scrollingElement.scrollBy(0, - this.el.offsetHeight)
    }

    adjustMainPaddingTop() {
        if (this.isOverlay) {
            return;
        }
        this.main.style.paddingTop = this.isFixed ? this.el.getBoundingClientRect().height : "";
    }

    adjustFixedPosition() {
        compensateScrollbar(this.el, this.isFixed, false, 'right');
    }

    /**
     * @param {boolean} fixed
     */
    toggleFixedBehavior(fixed) {
        this.isFixed = fixed;
        this.adaptToHeaderChange();
        this.el.classList.toggle('o_header_affixed', fixed);
        this.adjustFixedPosition();
    }

    isVisible() {
        return this.isFixed || !this.isHidden;
    }

    /**
     * Checks if the size of the header will decrease by adding the
     * 'o_header_is_scrolled' class. If so, we do not add this class if the
     * remaining scroll height is not enough to stay above 'this.scrolledPoint'
     * after the transition, otherwise it causes the scroll position to move up
     * again below 'this.scrolledPoint' and trigger an infinite loop.
     *
     * @todo header effects should be improved in the future to not ever change
     * the page scroll-height during their animation. The code would probably be
     * simpler but also prevent having weird scroll "jumps" during animations
     * (= depending on the logo height after/before scroll, a scroll step (one
     * mousewheel event for example) can be bigger than other ones).
     */
    isScrollSufficient() {
        const scrollEl = document.scrollingElement;
        const remainingScroll = (scrollEl.scrollHeight - scrollEl.clientHeight) - this.scrolledPoint;
        const clonedHeader = this.el.cloneNode(true);
        scrollEl.append(clonedHeader);
        clonedHeader.classList.add('o_header_is_scrolled', 'o_header_affixed', 'o_header_no_transition');
        const endHeaderHeight = clonedHeader.offsetHeight;
        clonedHeader.remove();
        const heightDiff = this.el.getBoundingClientRect().height - endHeaderHeight;
        return heightDiff > 0 ? remainingScroll <= heightDiff : false;
    }

    onResize() {
        this.adjustFixedPosition();
        if (
            document.body.classList.contains('overflow-hidden')
            && uiUtils.getSize() >= SIZES.LG
        ) {
            this.el.querySelectorAll(".offcanvas.show").forEach(offcanvasEl => {
                Offcanvas.getOrCreateInstance(offcanvasEl).hide();
            });
            // Compatibility: can probably be removed, there is no such elements
            // in default navbars... although it could be used by custo.
            this.el.querySelectorAll(".navbar-collapse.show").forEach(collapseEl => {
                Collapse.getOrCreateInstance(collapseEl).hide();
            });
        }
    }

    onScroll() {
        console.log("hoe");
        const scroll = document.scrollingElement.scrollTop;
        if (!this.wasScrolled) {
            this.wasScrolled = true;
            if (scroll > 0) {
                this.el.classList.add('o_header_no_transition');
                this.adjustURLAutoScroll();
            }
        } else {
            this.el.classList.remove('o_header_no_transition');
            this.closeMenus = true;
        }
        const isScrolled = (scroll > this.scrolledPoint);
        if (this.isScrolled !== isScrolled) {
            this.transitionPossible = isScrolled && this.isScrollSufficient();
            if (!this.transitionPossible) {
                this.el.classList.toggle('o_header_is_scrolled', isScrolled);
                this.el.dispatchEvent(new Event('odoo-transitionstart'));
                this.isScrolled = isScrolled;
            }
        }

        if (this.doCloseOpenedMenus) {
            this.el.querySelectorAll(".dropdown-toggle.show").forEach(dropdownToggleEl => {
                Dropdown.getOrCreateInstance(dropdownToggleEl).hide();
            });
        }
    }
}
