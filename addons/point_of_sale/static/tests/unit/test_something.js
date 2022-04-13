/** @odoo-module **/

import PosComponent from 'point_of_sale.PosComponent';
import { makePosTestEnv } from './test_env';
import testUtils from 'web.test_utils';
import Registries from 'point_of_sale.Registries';
import { mount } from '@web/../tests/helpers/utils';
import { posServerData } from './test_server_data';
import { ormService } from "@web/core/orm_service";
import { registry } from "@web/core/registry";
const serviceRegistry = registry.category("services");

QUnit.module('test something', {
    before() {
        serviceRegistry.add("orm", ormService);
    },
});

QUnit.test('make test env', async function (assert) {
    assert.expect(1);
    const env = await makePosTestEnv({ serverData: posServerData });
    await env.pos.load_server_data();
    assert.strictEqual(1, 1);
});
