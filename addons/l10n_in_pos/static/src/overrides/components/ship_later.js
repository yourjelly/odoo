/** @odoo-module */
import { DatePickerPopup } from "@point_of_sale/app/utils/date_picker_popup/date_picker_popup";
import { Many2OneField } from "@web/views/fields/many2one/many2one_field";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { useService } from "@web/core/utils/hooks";
import { onWillStart } from "@odoo/owl";
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

    setup() {
        super.setup();
        this.pos = usePos();
        this.orm = useService("orm");
        onWillStart(async () => {
            this.stateData = this.pos.models['res.country.state'].getAll().filter((state)=>state.country_id.code == 'IN');
        });
        debugger;
    }

    loadOptionsSource(request) {
        const inputValue = request?.toLowerCase();
        debugger;
        const records = this.props.data.map(({ id, name }) => [id, name]);
        const filteredRecords = inputValue
            ? records.filter(([_, name]) => name.toLowerCase().startsWith(inputValue))
            : records;
        return filteredRecords.map(this.mapRecordToOption);
    }

    mapRecordToOption([value, name]) {
        return {
            value,
            label: name.split("\n")[0],
            displayName: name,
        };
    }

    // get stateId() {
    //     return {
    //         name: "l10n_in_state_id",
    //         options: this.props.order,
    //         record: this.stateData,
    //     };
    // }

    get sources() {
        return [this.optionsSource];
    }

    get optionsSource() {
        return {
            options: this.loadOptionsSource.bind(this),
        };
    }

    onSelect(option, params = {}) {
        const record = {
            id: option.value,
            display_name: option.displayName,
        };
        this.selectedStateId = this.pos.models['res.country.state'].get(option.value);
        params.input.value = option.displayName;
        params.input.focus();
        debugger;
    }

    confirm() {
        debugger;
        this.props.getPayload(
            this.state.shippingDate < this._today() ? this._today() : this.state.shippingDate,
            this.selectedStateId
        );
        this.props.close();
    }
}
