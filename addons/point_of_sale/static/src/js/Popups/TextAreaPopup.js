odoo.define('point_of_sale.TextAreaPopup', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Draggable = require('point_of_sale.Draggable');
    const { useState, useRef } = owl.hooks;

    class TextAreaPopup extends PosComponent {
        static components = { Draggable };
        /**
         * @param {Object} props
         * @param {string} props.startingValue
         */
        constructor() {
            super(...arguments);
            this.state = useState({ inputValue: this.props.startingValue });
            this.inputRef = useRef('input');
        }
        mounted() {
            this.inputRef.el.focus();
        }
    }
    TextAreaPopup.template = 'TextAreaPopup';
    TextAreaPopup.defaultProps = {
        confirmText: 'Ok',
        cancelText: 'Cancel',
        title: '',
        body: '',
        startingValue: '',
    };

    return TextAreaPopup;
});
