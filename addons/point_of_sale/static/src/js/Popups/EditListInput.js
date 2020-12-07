odoo.define('point_of_sale.EditListInput', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');

    class EditListInput extends PosComponent {
        onKeyup(event) {
            if (event.key === "Enter" && event.target.value.trim() !== '') {
                this.trigger('create-new-item');
            }
        }
    }
    EditListInput.template = 'EditListInput';

    return EditListInput;
});
