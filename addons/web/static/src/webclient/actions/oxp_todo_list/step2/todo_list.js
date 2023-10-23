/** @odoo-module **/

import { registry } from "@web/core/registry";

import { Component, useState } from "@odoo/owl";
import { TodoItem } from "./todo_item";

export class TodoList extends Component {
    static template = "step2.TodoList";
    static components = { TodoItem };

    setup() {
        this.nextId = 1;
        this.state = useState({
            todoItems: [
                {
                    id: 1,
                    message: "Send email to John",
                    isDone: false,
                },
            ],
        });
    }

    onInputChange(ev) {
        this.state.todoItems.push({
            id: ++this.nextId,
            message: ev.target.value,
            isDone: false,
        });
        ev.target.value = "";
    }

    editMessage(todoItem, message) {
        todoItem.message = message;
    }

    delete(todoItem) {
        const index = this.state.todoItems.findIndex((todo) => todo.id === todoItem.id);
        this.state.todoItems.splice(index, 1);
    }

    toggleDone(todoItem) {
        todoItem.isDone = !todoItem.isDone;
    }
}

registry.category("actions").add("todo_list_step2", TodoList);
