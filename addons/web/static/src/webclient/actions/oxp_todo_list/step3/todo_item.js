/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export class TodoItem extends Component {
    static template = "step3.TodoItem";
    static props = {
        todo: Object,
    };

    setup() {
        this.state = useState({
            isInEdition: false,
        });
    }

    delete() {
        this.props.todo.delete();
    }

    toggleDone() {
        this.props.todo.toggleDone();
    }

    editMessage(ev) {
        this.props.todo.editMessage(ev.target.value);
        this.state.isInEdition = false;
    }

    switchInEdition() {
        this.state.isInEdition = true;
    }
}
