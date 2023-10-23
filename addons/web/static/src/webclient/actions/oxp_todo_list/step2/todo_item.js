/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export class TodoItem extends Component {
    static template = "step2.TodoItem";
    static props = {
        todo: Object,
        toggleDone: Function,
        delete: Function,
        editMessage: Function,
    };

    setup() {
        this.state = useState({
            isInEdition: false,
        });
    }

    delete() {
        this.props.delete();
    }

    toggleDone() {
        this.props.toggleDone();
    }

    editMessage(ev) {
        this.props.editMessage(ev.target.value);
        this.state.isInEdition = false;
    }

    switchInEdition() {
        this.state.isInEdition = true;
    }
}
