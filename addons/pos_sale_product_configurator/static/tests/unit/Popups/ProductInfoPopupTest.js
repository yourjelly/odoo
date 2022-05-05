/** @odoo-module **/

import PosComponent from 'point_of_sale.PosComponent';
import ProductInfoPopup from 'point_of_sale.ProductInfoPopup';
const { useBus } = require('@web/core/utils/hooks');
import { makePosTestEnv } from '@point_of_sale/../tests/unit/utils/test_env';
import { posServerData } from '@point_of_sale/../tests/unit/utils/test_server_data';
import testUtils from 'web.test_utils';
import { mount, click } from '@web/../tests/helpers/utils';
import { ormService } from '@web/core/orm_service';
import { registry } from '@web/core/registry';

const serviceRegistry = registry.category('services');
let savedData = {};

QUnit.module('ProductInfoPopup pos_sale_product_configurator Test', {
    async before() {
        this.mockRPC = async (route, args) => {
            if (args.method === 'get_product_info_pos') {
                return savedData;
            }
        };

        this.rootClass = class Root extends PosComponent {}; // there's not really any need to make pos reactive

        this.createDummyComponent = (mixin) => {
          return mixin(this.rootClass);
        }

        serviceRegistry.add('orm', ormService);
        this.env = await makePosTestEnv({ serverData: posServerData, mockRPC: this.mockRPC });
        await this.env.pos.load_server_data();
        this.product = Object.values(this.env.pos.db.product_by_id)[0];
        // we don't know which product we'll have so to make sure it has everything, we override some info
        this.props = { product: this.product, quantity :1 };
    },
    beforeEach() {
        savedData = {
            'all_prices': {
                'price_without_tax': 39.4,
                'price_with_tax': 45.31,
                'tax_details': [{
                    'name': 'Tax 15%',
                    'amount': 5.91
                }]
            },
            'pricelists': [{
                'name': 'Public Pricelist',
                'price': 39.4
            }],
            'warehouses': [],
            'suppliers': [],
            'variants': [],
            'optional_products': [{
                "name": "Conference Chair",
                "price": 33
            }, {
                "name": "Whiteboard Pen",
                "price": 1.2
            }]
        };
        this.target = testUtils.prepareTarget();

        this.rootClass.template = owl.xml/* html */ `
            <t>
                <ProductInfoPopup t-props='props'/>
            </t>
        `;
        this.rootClass.components = { ProductInfoPopup };
    }
});

// ----------------
// Extra section optional products
// ----------------

QUnit.test('Optional product section displayed', async function (assert) {
    await mount(this.rootClass, this.target, {env: this.env, props: this.props});
    assert.containsOnce(this.target, '.section-optional-product');

    const optionalData = savedData['optional_products'];
    const tableDataSelector = '.section-optional-product .section-optional-product-body table tr';
    const productNameContent1 = this.target.querySelector(tableDataSelector + ' td span').textContent;
    const productNameContent2 = this.target.querySelector(tableDataSelector + ':nth-child(2) td span').textContent;
    assert.strictEqual(productNameContent1, optionalData[0]['name']);
    assert.strictEqual(productNameContent2, optionalData[1]['name']);

    const priceContent1 = this.target.querySelector(tableDataSelector + ' td:nth-child(2)').textContent;
    const priceContent2 = this.target.querySelector(tableDataSelector + ':nth-child(2) td:nth-child(2)').textContent;
    const expectedPrice1 = this.env.pos.format_currency(optionalData[0]['price']);
    const expectedPrice2 = this.env.pos.format_currency(optionalData[1]['price']);
    assert.ok(priceContent1.includes(expectedPrice1));
    assert.ok(priceContent2.includes(expectedPrice2));
});

QUnit.test('Optional product section not displayed', async function (assert) {
    savedData['optional_products'] = [];
    await mount(this.rootClass, this.target, {env: this.env, props: this.props});
    assert.containsNone(this.target, '.section-optional-product');
});

QUnit.test('Search/filter optional products', async function (assert) {
    // When clicking on an optional products, it performs a search on the products list, the popup should then be closed
    const closeStep = 'close-popup';
    const expectedProductName = savedData['optional_products'][0]['name'];
    const ExtendedRoot = this.createDummyComponent(Root => class ExtendedRoot extends Root {
        setup() {
            super.setup();
            useBus(this.env.posbus, 'search-product-from-info-popup', ({ detail }) => assert.strictEqual(detail, expectedProductName));
            useBus(this.env.posbus, 'close-popup', () => assert.step(closeStep));
        }
    });
    assert.expect(3);

    await mount(ExtendedRoot, this.target, {env: this.env, props: this.props});
    await click(this.target.querySelector('.section-optional-product .section-optional-product-body table tr td span'));
    assert.verifySteps([closeStep]);
});
