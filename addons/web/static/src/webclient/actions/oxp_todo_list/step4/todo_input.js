/** @odoo-module **/

import { Component } from "@odoo/owl";

export class TodoInput extends Component {
    static template = "step4.TodoInput";

    onInputChange(ev) {
        this.env.todoListModel.add({
            message: ev.target.value,
        });
        ev.target.value = "";
    }
}
