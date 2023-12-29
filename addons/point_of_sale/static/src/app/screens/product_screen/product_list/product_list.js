/** @odoo-module */

import { Component, useState } from "@odoo/owl";
import { fuzzyLookup } from "@web/core/utils/search";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useService } from "@web/core/utils/hooks";
import { ProductCard } from "@point_of_sale/app/generic_components/product_card/product_card";

export class ProductList extends Component {
    static template = "point_of_sale.ProductList";
    static components = {
        ProductCard,
    };

    setup() {
        super.setup();
        this.pos = usePos();
        this.dialog = useService("dialog");
        this.notification = useService("pos_notification");
        this.state = useState({
            previousSearchWord: "",
            currentOffset: 0,
        });
    }

    addProductToOrder(product) {
        this.pos.addProductToCurrentOrder(product);
    }

    async onProductInfoClick(product) {
        const info = await this.pos.getProductInfo(product, 1);
        this.dialog.add(ProductInfoPopup, { info: info, product: product });
    }

    get searchWord() {
        return this.pos.searchProductWord.trim();
    }

    get productsToDisplay() {
        let list = [];

        if (this.searchWord !== "") {
            const product = this.pos.selectedCategoryId
                ? this.pos.models["product.product"].getBy(
                      "pos_categ_ids",
                      this.pos.selectedCategoryId
                  )
                : this.pos.models["product.product"].getAll();
            list = fuzzyLookup(
                this.searchWord,
                product,
                (product) => product.display_name + product.description_sale
            );
        } else if (this.pos.selectedCategoryId) {
            list = this.pos.models["product.product"].getBy(
                "pos_categ_ids",
                this.pos.selectedCategoryId
            );
        } else {
            list = this.pos.models["product.product"].getAll();
        }

        list = list
            .filter((product) => !this.getProductListToNotDisplay().includes(product.id))
            .slice(0, 100);

        return list.sort(function (a, b) {
            return a.display_name.localeCompare(b.display_name);
        });
    }

    getProductListToNotDisplay() {
        return [this.pos.config.tip_product_id, ...this.pos.pos_special_products_ids];
    }

    async loadDemoDataProducts() {
        this.state.loadingDemo = true;
        try {
            const result = await this.pos.data.loadServerMethodTemp(
                "pos.session",
                "load_product_frontend",
                [odoo.pos_session_id]
            );
            const models = result.related;
            const posOrder = result.posOrder;

            if (!models) {
                this.dialog.add(AlertDialog, {
                    title: _t("Demo products are no longer available"),
                    body: _t(
                        "A valid product already exists for Point of Sale. Therefore, demonstration products cannot be loaded."
                    ),
                });
            }

            for (const dataName of ["pos.category", "product.product", "pos.order"]) {
                if (!models[dataName] && Object.keys(posOrder).length === 0) {
                    this._showLoadDemoDataMissingDataError(dataName);
                }
            }

            if (this.pos.models["product.product"].length > 5) {
                this.pos.has_available_products = true;
            }

            this.pos.loadOpenOrders(posOrder);
        } finally {
            this.state.loadingDemo = false;
        }
    }

    _showLoadDemoDataMissingDataError(missingData) {
        console.error(
            "Missing '",
            missingData,
            "' in pos.session:load_product_frontend server answer."
        );
    }

    async onPressEnterKey() {
        const { searchProductWord } = this.pos;
        if (!searchProductWord) {
            return;
        }
        if (this.state.previousSearchWord !== searchProductWord) {
            this.state.currentOffset = 0;
        }
        const result = await this.loadProductFromDB();
        if (result.length > 0) {
            this.notification.add(
                _t('%s product(s) found for "%s".', result.length, searchProductWord),
                3000
            );
        } else {
            this.notification.add(_t('No more product found for "%s".', searchProductWord), 3000);
        }
        if (this.state.previousSearchWord === searchProductWord) {
            this.state.currentOffset += result.length;
        } else {
            this.state.previousSearchWord = searchProductWord;
            this.state.currentOffset = result.length;
        }
    }

    async loadProductFromDB() {
        const { searchProductWord } = this.pos;
        if (!searchProductWord) {
            return;
        }

        this.pos.setpos.selectedCategoryId(0);
        const product = await this.pos.data.searchRead(
            "product.product",
            [
                "&",
                ["available_in_pos", "=", true],
                "|",
                "|",
                ["name", "ilike", searchProductWord],
                ["default_code", "ilike", searchProductWord],
                ["barcode", "ilike", searchProductWord],
            ],
            this.pos.data.fields["product.product"],
            {
                offset: this.state.currentOffset,
                limit: 30,
            }
        );
        return product;
    }

    createNewProducts() {
        window.open("/web#action=point_of_sale.action_client_product_menu", "_self");
    }
}
