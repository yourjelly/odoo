/** @odoo-module **/

import makeTestEnvironment from 'web.test_env';
import { makeTestEnv } from '@web/../tests/helpers/mock_env';
import { PosGlobalState } from 'point_of_sale.models';
import { makeRAMLocalStorage } from '@web/core/browser/browser';
import { registry } from '@web/core/registry';
import { ormService } from '@web/core/orm_service';

const serviceRegistry = registry.category('services');

export async function makePosTestEnv(config) {
    const legacyEnv = makeTestEnvironment();
    if (!serviceRegistry.contains('orm')) {
        serviceRegistry.add('orm', ormService);
    }
    const webEnv = await makeTestEnv(config);
    const posEnv = Object.create(webEnv);
    posEnv.posbus = new owl.EventBus();
    const localStorage = makeRAMLocalStorage();
    const pos = PosGlobalState.create({ env: owl.markRaw(posEnv), legacyEnv: owl.markRaw(legacyEnv), localStorage });
    const reactivePos = owl.reactive(pos);
    posEnv.pos = reactivePos;
    return posEnv;
}
