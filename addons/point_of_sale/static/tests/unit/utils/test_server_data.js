/** @odoo-module **/

import { makeEnv, startServices } from '@web/env';
import { registry } from "@web/core/registry";
import { rpcService as realRpcService } from '@web/core/network/rpc_service';

const serviceRegistry = registry.category("services");
let data;

export const posServerData = {
    actions: {},
    models: {
        'pos.session': {
            fields: {},
            records: [],
            methods: {
                async load_pos_data() {
                    if (!data) {
                        const env = makeEnv();
                        const mockRpcService = serviceRegistry.get('rpc');
                        serviceRegistry.remove('rpc');
                        serviceRegistry.add('rpc', realRpcService);
                        await startServices(env);
                        data = await env.services.orm.call('pos.session', 'load_pos_data', [[odoo.pos_session_id]]);
                        serviceRegistry.remove('rpc');
                        serviceRegistry.add('rpc', mockRpcService);
                    }
                    return data;
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
