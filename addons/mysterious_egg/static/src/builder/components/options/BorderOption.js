import { Component } from "@odoo/owl";
import { defaultOptionComponents } from "../defaultComponents";

export class BorderOption extends Component {
    static template = "mysterious_egg.BorderOption";
    static components = {
        ...defaultOptionComponents,
    };
}
