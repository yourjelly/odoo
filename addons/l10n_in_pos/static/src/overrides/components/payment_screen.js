// import { DatePickerPopup } from "@point_of_sale/app/utils/date_picker_popup/date_picker_popup";
// import { PaymentScreen } from "@point_of_sale/static/src/app/screens/payment_screen/payment_screen";

// export class ShipLaterDialog extends PaymentScreen {
//     static template = "point_of_sale.PaymentScreen";
//     /**
//      * @override
//      */
//     setup(){
//         debugger;
//     }
//     async toggleShippingDatePicker() {
//         debugger;
//         if (!this.currentOrder.getShippingDate()) {
//             this.dialog.add(DatePickerPopup, {
//                 title: _t("Select the shipping date"),
//                 getPayload: (shippingDate) => {
//                     this.currentOrder.setShippingDate(shippingDate);
//                 },
//             });
//         } else {
//             this.currentOrder.setShippingDate(false);
//         }
//     }
// }

/** @odoo-module */

// import { PaymentScreen } from "@point_of_sale/static/app/screens/payment_screen/payment_screen";
// import { PosOrderline } from "@point_of_sale/app/models/pos_order_line";
import { patch } from "@web/core/utils/patch";
import { ShipLater } from "./ship_later";
import { _t } from "@web/core/l10n/translation";
import { PaymentScreen } from "../../../../../point_of_sale/static/src/app/screens/payment_screen/payment_screen";

patch(PaymentScreen.prototype, {
    setup(vals) {
        super.setup();

        // this.recordData = this.pos.data.models["res.country.state"].find((state)=>{
        //     state.id = 1;
        // })
        // this.model = 
        this.recordData = this.getPlaceOfSupply;
    },
    async toggleShippingDatePicker() {

        // params = {
        //     title: _t("Select the shipping date"),
        //     getPayload: (shippingDate) => {
        //         this.currentOrder.setShippingDate(shippingDate);
        //     },
        //     order: this.currentOrder,
        //     // countryState: this.model.root.data,
        // };
        // debugger;
        // if (!this.currentOrder.getShippingDate()) {
        //         this.dialog.add(ShipLater,params);
        //     } else {
        //         this.currentOrder.setShippingDate(false);
        //     }
        if (!this.currentOrder.getShippingDate()) {
            this.dialog.add(ShipLater, {
                title: _t("Select the shipping date"),
                getPayload: (shippingDate, stateId) => {
                    this.currentOrder.setShippingDate(shippingDate);
                    this.currentOrder.l10n_in_state_id = stateId;
                },
                order: this.currentOrder,
                data: this.recordData,
            });
        } else {
            this.currentOrder.setShippingDate(false);
        }
    },

    get getPlaceOfSupply(){
        let states = this.pos.models['res.country.state'].getAll()
        let l10n_in_state = [];
        for(const state of states ){
            if(state.country_id.code == 'IN'){
                l10n_in_state.push({id: state.id, name:state.name});
            }
        }
        // const placeOfSupply = Object.entries(this.pos.data.models["res.country.state"]).find((state)=>{
        //     state.country_id.code = 'IN';
        // })
        return l10n_in_state;
    }
});

