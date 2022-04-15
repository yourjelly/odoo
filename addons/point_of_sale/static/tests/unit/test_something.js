/** @odoo-module **/

import PosComponent from 'point_of_sale.PosComponent';
import OrderWidget from 'point_of_sale.OrderWidget';
import { makePosTestEnv } from './utils/test_env';
import { posServerData } from './utils/test_server_data';
import testUtils from 'web.test_utils';
import { mount } from '@web/../tests/helpers/utils';
import { ormService } from '@web/core/orm_service';
import { registry } from '@web/core/registry';
import { batched } from 'point_of_sale.utils';

const serviceRegistry = registry.category('services');

QUnit.module('test something', {
    beforeEach() {
        serviceRegistry.add('orm', ormService);
        localStorage.clear();
    },
});

QUnit.test('make test env', async function (assert) {
    assert.expect(1);
    const env = await makePosTestEnv({ serverData: posServerData });
    await env.pos.load_server_data();
    assert.strictEqual(1, 1);
});

QUnit.test('test OrderWidget', async function (assert) {
    assert.expect(5);
    const env = await makePosTestEnv({ serverData: posServerData });
    await env.pos.load_server_data();

    class Root extends PosComponent {
        setup() {
            super.setup();
            const pos = owl.reactive(
                this.env.pos,
                batched(() => this.render(true))
            );
            owl.useSubEnv({ pos });
        }
    }
    Root.template = owl.xml/* html */ `
        <t>
            <OrderWidget />
        </t>
    `;
    Root.components = { OrderWidget };

    const root = await mount(Root, testUtils.prepareTarget(), { env });
    await testUtils.nextTick();
    assert.equal(
        root.el.innerHTML,
        '<div class="order"><div class="order-empty"><i class="fa fa-shopping-cart" role="img" aria-label="Shopping cart" title="Shopping cart"></i><h1>This order is empty</h1></div></div>'
    );

    // add two orderlines.
    const order = env.pos.get_order();
    const products = Object.values(env.pos.db.product_by_id);
    order.add_product(products[0]);
    order.add_product(products[1]);

    await testUtils.nextTick();
    const lines = root.el.querySelectorAll('li.orderline');

    // second line should be selected.
    assert.equal([...lines[0].classList].includes('selected'), false);
    assert.equal([...lines[1].classList].includes('selected'), true);

    // click first line.
    testUtils.dom.click(lines[0]);
    await testUtils.nextTick();

    // first line should be selected.
    assert.equal([...lines[0].classList].includes('selected'), true);
    assert.equal([...lines[1].classList].includes('selected'), false);
});
