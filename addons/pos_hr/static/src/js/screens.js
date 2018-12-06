odoo.define('pos_hr.screens', function (require) {
    "use strict";

var core = require('web.core');
var gui = require('point_of_sale.gui');
var ScreenWidget = require('point_of_sale.screens').ScreenWidget;

var _t = core._t;


/*--------------------------------------*\
 |         THE LOGIN SCREEN           |
\*======================================*/

// The login screen enables employees to log in to the PoS
// at startup or after it was locked, with either barcode, pin, or both.

var LoginScreenWidget = ScreenWidget.extend({
    template: 'LoginScreenWidget',

    /**
     * @override
     */
    show: function() {
        var self = this;
        this.$('.select-employee').click(function() {
            self.gui.select_employee({
                'security': true,
                'current_employee': self.pos.get_cashier(),
                'title':_t('Change Cashier'),})
            .then(function(employee){
                self.pos.set_cashier(employee);
                self.unlock_screen();
            });
        });
        this._super();
    },

    /**
     * @override
     */
    barcode_cashier_action: function(code) {
        this._super(code);
        this.unlock_screen();
    },

    unlock_screen: function() {
        var screen = (this.gui.pos.get_order() ? this.gui.pos.get_order().get_screen_data('previous-screen') : this.gui.default_screen) || this.gui.default_screen;
        this.gui.show_screen(screen);
    }
});

gui.define_screen({name:'login', widget: LoginScreenWidget});


return {
    LoginScreenWidget: LoginScreenWidget
};
});