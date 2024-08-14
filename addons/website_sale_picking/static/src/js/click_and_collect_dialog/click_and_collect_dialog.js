import { registry } from '@web/core/registry';
import { Component, useState, reactive } from '@odoo/owl';
import { useService } from '@web/core/utils/hooks';
import { rpc } from "@web/core/network/rpc";
import {
    LocationSelectorDialog
} from '@delivery/js/location_selector/location_selector_dialog/location_selector_dialog';

export class ClickAndCollect extends Component {
    static components = { };
    static template = 'website_sale_picking.ClickAndCollect';
    static props = {
        product_id: Number,
        selected_wh_location: { type: Object, optional: true},
    }
    setup() {
        super.setup();
        this.dialog = useService('dialog');
        this.state = useState({selected_wh_location: this.props.selected_wh_location});
    }
    async openLocationSelector(){
        const { zip_code, id } = this.state.selected_wh_location;
        this.dialog.add(LocationSelectorDialog, {
            isProductPage: true,
            productId: this.props.product_id,
            zipCode: zip_code || String(this.props.zipCode),
            selectedLocationId: String(id),
            save: async location => {
                const jsonLocation = JSON.stringify(location);
                this.state.selected_wh_location = JSON.parse(jsonLocation);
                // Assign the selected pickup location to the order.
                await rpc(
                    '/shop/set_click_and_collect',
                    {pickup_location_data: jsonLocation}
                );
            },
        });
    }
    getAddress(){
        return `${this.state.selected_wh_location.street} ${this.state.selected_wh_location.zip_code} ${this.state.selected_wh_location.city}`
    }

}

registry.category('public_components').add('website_sale_picking.ClickAndCollect', ClickAndCollect);