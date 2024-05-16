/** @odoo-module */
import { DatePickerPopup } from "@point_of_sale/app/utils/date_picker_popup/date_picker_popup";
import { Many2OneField } from "@web/views/fields/many2one/many2one_field";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useService } from "@web/core/utils/hooks";
import { Component, onWillStart } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { AutoComplete } from "@web/core/autocomplete/autocomplete";

export class ShipLater extends DatePickerPopup {
    static template = "l10n_in_pos.ShipLater";
    static components = {
        ...DatePickerPopup.components,
        Dropdown,
        AutoComplete,
        DropdownItem,
        Many2OneField,
    };
    static props = {
        ...DatePickerPopup.props,
        order: {type: Object, optional: true},
        data: {type: Object, optional: true},
    }

    setup(){
        super.setup();
        this.pos = usePos();
        this.orm = useService("orm");
        // this.recordData = this.props.order.records["res.country.state"];
        this.recordData = this.getPlaceOfSupply;
        onWillStart(async () => {
            // this.recordData = await this.orm.call("res.country.state", "get_l10n_in_state",[""])
            this.stateData = await this.orm.call("res.country.state", "search_read", [[]]);
        }
        );
    }
    // async getData(){
    //    return await this.pos.data.orm.call("res.country.state", "get_country_state", this.stateIdData);
    // }

    get stateId(){
        return {
            name: "l10n_in_state_id",
            options: this.props.order   ,
            record: this.stateData,
            // context: JSON.stringify({
            //     default_product_id: this.recordData.product_id[0],
            //     default_company_id: this.recordData.company_id[0],
            // }),
        };
    }

    // get getPos(){
    //     const demoData = [{
    //         options: [{1:'one'}]
    //     }];
    //     return demoData;
    // }
    // get sources() {
    //     return { options: [this.props.data] }
    // }

    get sources() {
        return [this.optionsSource];
    }

    get optionsSource() {
        debugger
        return {
            options: this.props.data,
        };
    }

    // get optionsSource() {
    //     const demo = {
    //         options: ['one','two'],
    //     }
    //     return {
    //         placeholder: ("Loading..."),
    //         options: demo,
    //     };
    // }

    onSelect(){
        return;
    }

}