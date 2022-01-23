/** @odoo-module **/

import { Component } from "@odoo/owl";

/**
 * Icons
 *
/**
 * @property {string} name
 * @property {boolean} colors
 */

/**
 * @extends Component
 */
export class Icon extends Component {
    get iconTemplateName() {
        return this.props.name ? 'web.oi_' + this.props.name : null;
    }

    get colors() {
        return this.props.colors;
    }
}
Icon.template = "web.Icon";

Icon.defaultProps = {
    colors: false,
};

Icon.props = {
    name: {
        type: String,
        optional: true
    },
    colors: {
        type: Boolean,
        optional: true
    },
    className: {
        type: [String, Object],
        optional: true,
    },
};