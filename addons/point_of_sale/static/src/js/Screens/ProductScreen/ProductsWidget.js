/** @odoo-module */

import { LegacyComponent } from "@web/legacy/legacy_component";
import { useListener } from "@web/core/utils/hooks";
import { usePos } from "@point_of_sale/app/pos_hook";

import { ProductItem } from "./ProductItem";
import { ProductsWidgetControlPanel } from "./ProductsWidgetControlPanel";

const { useState } = owl;

export class ProductsWidget extends LegacyComponent {
    static components = { ProductItem, ProductsWidgetControlPanel };
    static template = "ProductsWidget";

    /**
     * @param {Object} props
     * @param {number?} props.startCategoryId
     */
    setup() {
        super.setup();
        useListener("switch-category", this._switchCategory);
        useListener("update-search", this._updateSearch);
        useListener("clear-search", this._clearSearch);
        useListener("update-product-list", this._updateProductList);
        this.state = useState({ searchWord: "" });
        this.pos = usePos();
    }
    get selectedCategoryId() {
        return this.env.pos.selectedCategoryId;
    }
    get searchWord() {
        return this.state.searchWord.trim();
    }
    get productsToDisplay() {
        let list = [];
        if (this.searchWord !== "") {
            list = this.env.pos.db.search_product_in_category(
                this.selectedCategoryId,
                this.searchWord
            );
        } else {
            list = this.env.pos.db.get_product_by_category(this.selectedCategoryId);
        }
        return list.sort(function (a, b) {
            return a.display_name.localeCompare(b.display_name);
        });
    }
    get subcategories() {
        return this.env.pos.db
            .get_category_childs_ids(this.selectedCategoryId)
            .map((id) => this.env.pos.db.get_category_by_id(id));
    }
    get breadcrumbs() {
        if (this.selectedCategoryId === this.env.pos.db.root_category_id) {
            return [];
        }
        return [
            ...this.env.pos.db.get_category_ancestors_ids(this.selectedCategoryId).slice(1),
            this.selectedCategoryId,
        ].map((id) => this.env.pos.db.get_category_by_id(id));
    }
    get hasNoCategories() {
        return this.env.pos.db.get_category_childs_ids(0).length === 0;
    }
    get shouldShowButton() {
        return this.productsToDisplay.length === 0 && this.searchWord;
    }
    _switchCategory(event) {
        this.env.pos.setSelectedCategoryId(event.detail);
    }
    _updateSearch(event) {
        this.state.searchWord = event.detail;
    }
    _clearSearch() {
        this.state.searchWord = "";
    }
    _updateProductList(event) {
        this.render(true);
        this.trigger("switch-category", 0);
    }
}
