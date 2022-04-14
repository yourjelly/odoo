/** @odoo-module **/

import { loadPosData } from './test_load_pos_data';

export const posServerData = {
    actions: {},
    models: {
        'pos.session': {
            fields: {},
            records: [],
            methods: {
                load_pos_data() {
                    return loadPosData;
                },
            },
        },
        'ir.model.data': {
            fields: {},
            records: [],
            methods: {
                check_object_reference() {
                    return ["uom.uom", 1]
                }
            }
        }
    },
    views: {},
};
