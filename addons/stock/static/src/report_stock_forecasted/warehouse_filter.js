/** @odoo-module **/
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";
import { useService } from "@web/core/utils/hooks";
const { Component, onWillStart, useState} = owl;

export class WarehouseFilter extends Component {

    setup() {
        this.orm = useService("orm");
        this.context = this.props.action.context;
        this.active_warehouse = useState({});
        onWillStart(this.onWillStart)
    }

    async onWillStart() {
        this.warehouses = await this.orm.call('report.stock.report_product_product_replenishment', 'get_warehouses', []);

        if (this.context.warehouse) {
            this.active_warehouse = this.warehouses.find(w => w.id == this.context.warehouse);
        }
        else {
            this.active_warehouse = this.warehouses[0];
            this._setWarehouseInContext(this.active_warehouse.id);
        }
        this.displayWarehouseFilter = (this.warehouses.length > 1);
        this.warehouse_id = this.active_warehouse;
    }

    _onSelected(id){
        this.warehouse_id = Number(id);
        this.active_warehouse = this.warehouses.find(w => w.id == this.warehouse_id);
        this._setWarehouseInContext(this.active_warehouse.id);//TO CHECK
        //this.props.updateContext({active_warehouse : this.active_warehouse}); //TO Check
        this.props.onSelected({warehouse: this.warehouse_id});
    }

    _setWarehouseInContext(id){
        this.props.updateContext({warehouse : id});
    }

}

WarehouseFilter.template = 'stock.WarehouseFilter';
WarehouseFilter.components = {Dropdown, DropdownItem};
WarehouseFilter.props = {action: {type : Object, optional: true}, onSelected : Function, updateContext : Function};