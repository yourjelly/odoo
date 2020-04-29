odoo.define('pos_hr.CashierName', function (require) {
    'use strict';

    const CashierName = require('point_of_sale.CashierName');
    const Registries = require('point_of_sale.Registries');
    const useSelectEmployee = require('pos_hr.useSelectEmployee');

    const PosHrCashierName = (CashierName) =>
        class extends CashierName {
            constructor() {
                super(...arguments);
                const { selectEmployee } = useSelectEmployee();
                this.selectEmployee = selectEmployee;
            }
            mounted() {
                this.env.pos.on('change:cashier', this.render, this);
            }
            willUnmount() {
                this.env.pos.off('change:cashier', null, this);
            }
            async selectCashier() {
                if (!this.env.pos.config.module_pos_hr) return;

                const list = this.env.pos.employees
                    .filter((employee) => employee.id !== this.env.pos.get_cashier().id)
                    .map((employee) => {
                        return {
                            id: employee.id,
                            item: employee,
                            label: employee.name,
                            isSelected: false,
                        };
                    });

                const employee = await this.selectEmployee(list);
                if (employee) {
                    this.env.pos.set_cashier(employee);
                }
            }
        };

    Registries.Component.extend(CashierName, PosHrCashierName);

    return CashierName;
});
