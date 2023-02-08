/** @odoo-module **/

import {registry} from "@web/core/registry";
import {useService} from "../../../web/static/src/core/utils/hooks";
import { CheckBox } from "@web/core/checkbox/checkbox";

const { Component, onWillStart, useState} = owl;

class SafetyStock extends Component {
    setup() {
        this.context = this.props.action.context;
        this.orm = useService("orm");
        this.action = useService("action");
        this.state = useState({display: this._getDisplayDefault()});
        this.Z = 1.28
        onWillStart(async () => {
             this.state.orderpoints = Object.values(await this.orm.call(
                'stock.warehouse.orderpoint', 'get_safety_stock_stats',
                [],
                {
                    context: this.context,
                    orderpoint_ids: this.context.active_ids
                }
            ));
            this._computeSafetyStock();
        });
    }

    async reloadReport() {
        return this.action.doAction({
                type: "ir.actions.client",
                tag: "generate_safety_stock",
                context: this.context,
                name: 'Safety Stock Report'
            },
            {
                stackPosition: 'replaceCurrentAction'
            });
    }

    async updateZ(event) {
        this.Z = event.target.valueAsNumber;
        this._computeSafetyStock();
    }

    onDisplayChange(self, field, checked) {
        self.state.display[field] = checked
    }

    _computeSafetyStock(){
        this.state.orderpoints.forEach(o => {
            o['SS1'] = Math.round(this._SS1(o))
            o['SS2'] = Math.round(this._SS2(o))
            o['SS3'] = Math.round(this._SS3(o))
            o['SS4'] = Math.round(this._SS4(o))
            o['SS5'] = Math.round(this._SS5(o))
        })
    }

    _SS1(orderpoint) {
        return (orderpoint['max_lead_time'] * orderpoint['max_sales']) -
            (orderpoint['mean_lead_time'] * orderpoint['mean_sales'])
    }

    _SS2(orderpoint) {
        return this.Z * Math.sqrt(orderpoint['variance_sales']) * Math.sqrt(orderpoint['mean_lead_time'])
    }

    _SS3(orderpoint) {
        return this.Z * orderpoint['mean_sales'] * Math.sqrt(orderpoint['variance_lead_time'])
    }

    _SS4(orderpoint) {
        return this.Z * Math.sqrt((orderpoint['mean_lead_time'] * orderpoint['variance_sales']) +
            (Math.pow(orderpoint['mean_sales'],2) * orderpoint['variance_lead_time']))
    }

    _SS5(orderpoint) {
        return this.Z * (Math.sqrt(orderpoint['mean_lead_time']) * Math.sqrt(orderpoint['variance_sales']) +
            orderpoint['mean_sales'] * Math.sqrt(orderpoint['variance_lead_time']))
    }

    _getDisplayDefault() {
        return {
            SS1: true,
            SS2: true,
            SS3: true,
            SS4: true,
            SS5: true,
            sales_stats: true,
            ld_stats: true
        }
    }


}

SafetyStock.template = "stock.SafetyStock"

SafetyStock.components = { CheckBox }

registry.category("actions").add("generate_safety_stock", SafetyStock);

