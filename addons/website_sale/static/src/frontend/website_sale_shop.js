/** @odoo-module **/

import { registry, Widget } from "web.public.widget";

/**
 * This widget is responsible for any logic necessary on the /shop page.
 */
export const WebsiteSaleShop = Widget.extend({
    selector: "#wrap.o_wsale_products_page",
    events: {
        // Offcanvas
        "show.bs.offcanvas #o_wsale_offcanvas": "toggleFilters",
        "hidden.bs.offcanvas #o_wsale_offcanvas": "toggleFilters",
        // Filters and options
        'newRangeValue #o_wsale_price_range_option input[type="range"]': "onPriceRangeSelected",
        "click [data-link-href]": "onClickLink",
    },

    start() {
        const result = this._super(...arguments);
        this.productGridEl = this.el.querySelector(".o_wsale_products_grid_table_wrapper");
        return result;
    },

    // Offcanvas

    /**
     * Unfold active filters, fold inactive ones.
     */
    toggleFilters(ev) {
        for (const btn of this.el.querySelectorAll("button[data-status]")) {
            if (
                (btn.classList.contains("collapsed") && btn.dataset.status == "active") ||
                (!btn.classList.contains("collapsed") && btn.dataset.status == "inactive")
            ) {
                btn.click();
            }
        }
    },

    // Filters and options

    /**
     * Increase the product grid's opacity.
     * Used when applying new filters for visual feedback.
     */
    _obscureProductGrid() {
        if (!this.productGridEl) {
            return;
        }
        this.productGridEl.classList.add("opacity-50");
    },

    /**
     * Handle change of price filter.
     */
    onPriceRangeSelected(ev) {
        const range = ev.currentTarget;
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.delete("min_price");
        searchParams.delete("max_price");
        if (parseFloat(range.min) !== range.valueLow) {
            searchParams.set("min_price", range.valueLow);
        }
        if (parseFloat(range.max) !== range.valueHigh) {
            searchParams.set("max_price", range.valueHigh);
        }
        this._obscureProductGrid();
        window.location.href = window.location.pathname + "?" + searchParams.toString();
    },

    /**
     * Visual feedback when clicking on a link.
     */
    onClickLink(ev) {
        this._obscureProductGrid();
        window.location.href = ev.currentTarget.dataset.linkHref;
    },
});

registry.WebsiteSaleShop = WebsiteSaleShop;
