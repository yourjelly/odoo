/** @odoo-module **/

import PosComponent from 'point_of_sale.PosComponent';
import ProductInfoPopup from 'point_of_sale.ProductInfoPopup';
import { makePosTestEnv } from '../utils/test_env';
import { posServerData } from '../utils/test_server_data';
import testUtils from 'web.test_utils';
import { mount } from '@web/../tests/helpers/utils';
import { ormService } from '@web/core/orm_service';
import { registry } from '@web/core/registry';
import { batched } from 'point_of_sale.utils';

const serviceRegistry = registry.category('services');


QUnit.module('test something rpc', {
    before() {
        const savedData = {
            "all_prices": {
                "price_without_tax": 39.4,
                "price_with_tax": 45.31,
                "tax_details": [{
                    "name": "Tax 15%",
                    "amount": 5.91
                }]
            },
            "pricelists": [{
                "name": "Public Pricelist",
                "price": 39.4
            }],
            "warehouses": [{
                "name": "San Francisco",
                "available_quantity": 30,
                "forecasted_quantity": 30,
                "uom": "Units"
            }],
            "suppliers": [{
                "name": "Wood Corner",
                "delay": 2,
                "price": 28
            }],
            "variants": [{
                "name": "Legs",
                "values": [
                    {
                        "name": "Steel",
                        "search": "Conference Chair Steel"
                    },{
                        "name": "Aluminium",
                        "search": "Conference Chair Aluminium"
                    }
                ]
            }]
        };
        this.mockRPC = async (route, args) => {
            if (args.method === "get_product_info_pos") {
                return savedData;
            }
        };
    },
    async beforeEach() {
        serviceRegistry.add('orm', ormService);
        this.env = await makePosTestEnv({ serverData: posServerData, mockRPC: this.mockRPC });
        await this.env.pos.load_server_data();

        this.rootClass = class Root extends PosComponent {
            setup() {
                super.setup();
                const pos = owl.reactive(
                    this.env.pos,
                    batched(() => this.render(true))
                );
                owl.useSubEnv({ pos });
            }
        }

        const products = Object.values(this.env.pos.db.product_by_id);
        this.props = { product: products[0], quantity :1 };
        this.rootClass.template = owl.xml/* html */ `
            <t>
                <ProductInfoPopup t-props="props"/>
            </t>
        `;
        this.rootClass.components = { ProductInfoPopup };


    },
});

QUnit.test('Component display', async function (assert) {
    const root = await mount(this.rootClass, testUtils.prepareTarget(), { env: this.env, props: this.props });
    await testUtils.nextTick();
    assert.equal(
        root.el.innerHTML,
        '<div class="order"><div class="order-empty"><i class="fa fa-shopping-cart" role="img" aria-label="Shopping cart" title="Shopping cart"></i><h1>This order is empty</h1></div></div>'
    );
});

QUnit.test('Search/filter product variant', async function (assert) {

});

