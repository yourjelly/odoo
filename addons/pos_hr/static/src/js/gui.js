odoo.define('pos_hr.gui', function (require) {
    "use strict";

var gui = require('point_of_sale.gui');

gui.Gui.include({
    _show_first_screen: function () {
        if (this.pos.config.module_pos_hr) {
            this.show_screen('login');
        } else {
            this._super();
        }
    }
});
});