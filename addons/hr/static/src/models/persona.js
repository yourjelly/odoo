/** @odoo-module **/

import { registerPatch } from '@mail/model/model_core';

registerPatch({
    name: 'Persona',
    modelMethods: {
        async getFromIdentifyingId(person) {
            const { employeeId } = person;
            if (employeeId) {
                const employee = this.messaging.models['Employee'].insert({ id: employeeId });
                if (!employee.partner) {
                    await employee.checkIsUser();
                }
                if (employee.partner) {
                    return this.messaging.models['Persona'].insert({ partner: employee.partner });
                }
            }
            return this._super(person);
        },
    },
});
