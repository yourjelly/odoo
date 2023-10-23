/** @odoo-module **/

import { registry } from "@web/core/registry";

import { Component, useState } from "@odoo/owl";

export class TodoList extends Component {
    static template = "step1.TodoList";

    setup() {
        this.nextId = 1;
        this.state = useState({
            todoItems: [
                {
                    id: 1,
                    message: "Send email to John",
                    done: false,
                },
            ],
            itemInEdition: null,
        });
    }

    onInputChange(ev) {
        this.state.todoItems.push({
            id: this.nextId++,
            message: ev.target.value,
            done: false,
        });
        ev.target.value = "";
    }

    getTodoItem(id) {
        return this.state.todoItems.find((todo) => todo.id === id);
    }

    delete(id) {
        const index = this.state.todoItems.findIndex((todo) => todo.id === id);
        this.state.todoItems.splice(index, 1);
    }

    toggleDone(id) {
        const todo = this.state.todoItems.find((todo) => todo.id === id);
        todo.isDone = !todo.isDone;
    }

    switchInEdition(id) {
        const todo = this.state.todoItems.find((todo) => todo.id === id);
        this.state.itemInEdition = todo.id;
    }

    editMessage(ev) {
        const todo = this.state.todoItems.find((todo) => todo.id === this.state.itemInEdition);
        todo.message = ev.target.value;
        this.state.itemInEdition = null;
    }
}

registry.category("actions").add("todo_list_step1", TodoList);
