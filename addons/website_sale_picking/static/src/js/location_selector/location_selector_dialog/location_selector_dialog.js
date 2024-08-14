/** @odoo-module **/

import {
    LocationSelectorDialog
} from '@delivery/js/location_selector/location_selector_dialog/location_selector_dialog';
import { patch } from '@web/core/utils/patch';
import { rpc } from "@web/core/network/rpc";

patch(LocationSelectorDialog, {
    props: {
        ...LocationSelectorDialog.props,
        productId: { type: Number, optional: true },
        isProductPage: { type: Boolean, optional: true },
    },
});

patch(LocationSelectorDialog.prototype, {
    setup() {
        super.setup(...arguments);

        if (this.props.isProductPage) {
            this.getLocationUrl = '/shop/product/store_locations';
        }
    },
    async _getLocations(zip) {
        return rpc(this.getLocationUrl, {product_id: this.props.productId});
    },
});
