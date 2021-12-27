odoo.define('pos_hr.employees', function (require) {
    "use strict";

var models = require('point_of_sale.models');
const Registries = require('point_of_sale.Registries');

models.load_models([{
    model:  'hr.employee',
    // loaded: function(self, employees) {
    //     if (self.config.module_pos_hr) {
    //         self.employees = employees;
    //         self.employee_by_id = {};
    //         // self.employees.forEach(function(employee) {
    //         //     self.employee_by_id[employee.id] = employee;
    //         //     // todo-ref can do this in the back end so no need to provide all the users in point_of_sale
    //         //     var hasUser = self.users.some(function(user) {
    //         //         if (user.id === employee.user_id[0]) {
    //         //             employee.role = user.role;
    //         //             return true;
    //         //         }
    //         //         return false;
    //         //     });
    //         //     if (!hasUser) {
    //         //         employee.role = 'cashier';
    //         //     }
    //         // });
    //     }
    // }
}]);

Registries.PosModelRegistry.extend(models.PosGlobalState, (PosGlobalState) => {

class PosHrPosModel extends PosGlobalState {
    constructor(obj) {
        super(obj);
        this.cashier = null;
    }
    async _processData(loadedData) {
        await super._processData(...arguments);
        if (this.config.module_pos_hr) {
            this.employees = loadedData['hr.employee'];
            this.employee_by_id = loadedData['employee_by_id'];
        }
    }
    async after_load_server_data() {
        await super.after_load_server_data(...arguments);
        this.hasLoggedIn = !this.config.module_pos_hr;
    }
    set_cashier(employee) {
        this.cashier = employee;
        const selectedOrder = this.get_order();
        if (selectedOrder && !selectedOrder.get_orderlines().length) {
            // Order without lines can be considered to be un-owned by any employee.
            // We set the employee on that order to the currently set employee.
            selectedOrder.employee = employee;
        }
        if (!this.cashierHasPriceControlRights() && this.PRODUCT_SCREEN.numpadMode === 'price') {
            this.PRODUCT_SCREEN.numpadMode = 'quantity';
        }
    }

    /**{name: null, id: null, barcode: null, user_id:null, pin:null}
     * If pos_hr is activated, return {name: string, id: int, barcode: string, pin: string, user_id: int}
     * @returns {null|*}
     */
    get_cashier() {
        if (this.config.module_pos_hr) {
            return this.cashier;
        }
        return super.get_cashier();
    }
    get_cashier_user_id() {
        if (this.config.module_pos_hr) {
            return this.cashier.user_id ? this.cashier.user_id : null;
        }
        return super.get_cashier_user_id();
    }
}

return PosHrPosModel;
});

Registries.PosModelRegistry.extend(models.Order, (Order) => {

class PosHrOrder extends Order {
    constructor(obj, options) {
        super(...arguments);
        if (!options.json && this.pos.config.module_pos_hr) {
            this.employee = this.pos.get_cashier();
        }
    }
    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
        if (this.pos.config.module_pos_hr) {
            this.employee = this.pos.employee_by_id[json.employee_id];
        }
    }
    export_as_JSON() {
        const json = super.export_as_JSON(...arguments);
        if (this.pos.config.module_pos_hr) {
            json.employee_id = this.employee ? this.employee.id : false;
        }
        return json;
    }
}

return PosHrOrder;
});

});
