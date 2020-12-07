odoo.define('point_of_sale.SelectionPopup', function (require) {
    'use strict';

    const Draggable = require('point_of_sale.Draggable');

    /**
     * @param {Object} props
     * @param {string} [props.cancelText='Cancel']
     * @param {string} [props.title='Select']
     * @param {{ id: string, label: string, isSelected: boolean}[]} [props.list=[]]
     */
    class SelectionPopup extends owl.Component {}
    SelectionPopup.components = { Draggable };
    SelectionPopup.template = 'SelectionPopup';
    SelectionPopup.defaultProps = {
        cancelText: 'Cancel',
        title: 'Select',
        list: [],
    };

    return SelectionPopup;
});
