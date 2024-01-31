/** @odoo-module **/

import { Component,useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

/**
 * General component for common logic between different dialogs.
 */
export class TestWidget extends Component {
    static template = "web_editor.TestWidget";
    static components = { Dialog };
    static props = {
        close: Function,
        insert: Function,
    };
    setup() {
        this.state = useState({
            valueFirst: 0,
            valueSecond: 0
        })
    }
    insert() {
        this.props.close();
        const value = +this.state.valueFirst + +this.state.valueSecond;
        this.props.insert(value);
    }
}