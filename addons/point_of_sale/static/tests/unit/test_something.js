/** @odoo-module **/

import PosComponent from 'point_of_sale.PosComponent';
import OrderWidget from 'point_of_sale.OrderWidget';
import { makePosTestEnv } from './utils/test_env';
import { posServerData } from './utils/test_server_data';
import testUtils from 'web.test_utils';
import { mount } from '@web/../tests/helpers/utils';
import { ormService } from '@web/core/orm_service';
import { registry } from '@web/core/registry';
const serviceRegistry = registry.category('services');

QUnit.module('test something', {
    before() {
        serviceRegistry.add('orm', ormService);
    },
});

// QUnit.test('make test env', async function (assert) {
//     assert.expect(1);
//     const env = await makePosTestEnv({ serverData: posServerData });
//     await env.pos.load_server_data();
//     assert.strictEqual(1, 1);
// });

QUnit.test('OrderWidget', async function (assert) {
    assert.expect(3);
    localStorage.clear();
    const env = await makePosTestEnv({ serverData: posServerData });
    await env.pos.load_server_data();

    const orderWidget = await mount(OrderWidget, testUtils.prepareTarget(), { env });
    await testUtils.nextTick();
    assert.equal(
        orderWidget.el.innerHTML,
        '<div class="order"><div class="order-empty"><i class="fa fa-shopping-cart" role="img" aria-label="Shopping cart" title="Shopping cart"></i><h1>This order is empty</h1></div></div>'
    );
    const order = env.pos.get_order();
    order.add_product(env.pos.db.product_by_id[49]);
    order.add_product(env.pos.db.product_by_id[48]);
    await orderWidget.render(); // TODO, should automatically rerender.
    await testUtils.nextTick();
    const lines = orderWidget.el.querySelectorAll('li.orderline');
    assert.equal(lines.length, 2);
    assert.equal([...lines[1].classList].includes('selected'), true);
});
