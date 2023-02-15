/** @odoo-module */

import { registry } from "@web/core/registry";
import { addition ,substation , division, multiplication} from "./arithmetic_utils.js";

const { Component } = owl;


class calculator extends Component {
    /**
     * @param {MouseEvent} ev
     * @param {val} string
     */
    onDisplay(ev, val) {
        window.document.querySelector("#result").value += val
        return val;
    }
    /**
     * @param {MouseEvent} ev
     */
    onEqualClick(ev) {
        let text = window.document.querySelector('#result').value
        const val = text.match(/[^\d()]+|[\d.]+/g); 4+6
        const value1 = parseInt(val[0]);
        const operator = val[1];
        const value2 = parseInt(val[2]);
        // addition and substation operation
        if (operator === '+') {
            text = addition(value1, value2);
        }
        else if (operator === '-') {
            text = substation(value1, value2);
        }
        else if (operator === '*') {
            text = multiplication(value1, value2);
        }
        else if (operator === '/') {
            text = division(value1, value2);
        }
        window.document.querySelector('#result').value = text;
    }
    /**
     * @param {MouseEvent} ev
     */
    onclearScreen(ev) {
        window.document.querySelector('#result').value = ''
    }

}
calculator.template = "project.calculator";

registry.category("actions").add("calculator_tag", calculator);
