/** @odoo-module **/

import { registry } from "@web/core/registry";

import { Component, useState, useSubEnv } from "@odoo/owl";
import { TodoItem } from "./todo_item";
import { TodoListModel } from "./todo_model";
import { ComponentA } from "./component_a";

export class TodoList extends Component {
    static template = "step4.TodoList";
    static components = { TodoItem, ComponentA };

    setup() {
        this.todoListModel = useState(
            new TodoListModel([
                {
                    message: "Send email to John",
                    isDone: false,
                },
            ])
        );

        useSubEnv({
            todoListModel: this.todoListModel,
        });
    }

    onInputChange(ev) {
        this.state.todoListModel.add({
            message: ev.target.value,
        });
        ev.target.value = "";
    }
}

registry.category("actions").add("todo_list_step4", TodoList);
