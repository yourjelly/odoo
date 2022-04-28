/** @odoo-module **/

import PosComponent from 'point_of_sale.PosComponent';
import ProductInfoPopup from 'point_of_sale.ProductInfoPopup';
import { makePosTestEnv } from '../utils/test_env';
import { posServerData } from '../utils/test_server_data';
import { removeSpace } from '../utils/test_utils';
import testUtils from 'web.test_utils';
import { mount } from '@web/../tests/helpers/utils';
import { ormService } from '@web/core/orm_service';
import { registry } from '@web/core/registry';
import { batched } from 'point_of_sale.utils';

const serviceRegistry = registry.category('services');


QUnit.module('test something rpc', {
    async before() {
        this.savedData = {
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
            'warehouses': [{
                'name': 'San Francisco',
                'available_quantity': 30,
                'forecasted_quantity': 30,
                'uom': 'Units'
            }],
            'suppliers': [{
                'name': 'Wood Corner',
                'delay': 2,
                'price': 28
            }],
            'variants': [{
                'name': 'Legs',
                'values': [
                    {
                        'name': 'Steel',
                        'search': 'Conference Chair Steel'
                    },{
                        'name': 'Aluminium',
                        'search': 'Conference Chair Aluminium'
                    }
                ]
            }]
        };
        this.mockRPC = async (route, args) => {
            if (args.method === 'get_product_info_pos') {
                return this.savedData;
            }
        };
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

        this.product = Object.values(this.env.pos.db.product_by_id)[0];
        // we don't know which product we'll have so to make sure it has everything, we override some info
        this.product.barcode = this.product.barcode || '00000';
        this.product.default_code = this.product.default_code || 'E-COM01';
        this.props = { product: this.product, quantity :1 };
        this.rootClass.template = owl.xml/* html */ `
            <t>
                <ProductInfoPopup t-props='props'/>
            </t>
        `;
        this.rootClass.components = { ProductInfoPopup };
        this.target = testUtils.prepareTarget();
        await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    },
});

QUnit.test('Component basic display', async function (assert) {
    // assert.expect(2);
    const productNameContent = this.target.querySelector('.global-info-title.product-name').textContent;
    assert.strictEqual(productNameContent, this.product.display_name);

    const productPriceContent = this.target.querySelector('.global-info-title.product-price').textContent;
    assert.strictEqual(productPriceContent, this.env.pos.format_currency(this.savedData['all_prices']['price_with_tax']));

    const additionalInfoContent = this.target.querySelector('.global-info-title.product-name ~ span').textContent;
    assert.strictEqual(removeSpace(additionalInfoContent), `${this.product.default_code} - ${this.product.barcode}`);

    const taxDetailsContent = this.target.querySelector('.global-info-title.product-price ~ div').textContent;
    const expectedTaxName = this.savedData['all_prices']['tax_details'][0]['name'];
    const expectedTaxAmount = this.env.pos.format_currency(this.savedData['all_prices']['tax_details'][0]['amount']);
    assert.strictEqual(removeSpace(taxDetailsContent), `${expectedTaxName}: ${expectedTaxAmount}`);
});

QUnit.test('Cost Margin display', async function (assert) {
    assert.expect(5);
    this.env.pos.config.is_margins_costs_accessible_to_every_user = false
    this.env.pos.get_cashier().role = 'cashier';
    await testUtils.nextTick(); // because we want the component to rerender based on the above changes
    const priceDetailSelector = '.section-financials-body table:nth-child(1) tr';
    assert.containsN(this.target, priceDetailSelector, 1);

    this.env.pos.config.is_margins_costs_accessible_to_every_user = true;
    await testUtils.nextTick();
    const expectedCost = this.env.pos.format_currency(this.product.standard_price);
    const margin = this.savedData['all_prices']['price_without_tax'] - this.product.standard_price;
    const marginPercentage = this.savedData['all_prices']['price_without_tax'] ? Math.round(margin/this.savedData['all_prices']['price_without_tax'] * 10000) / 100 : 0;
    const expectedMargin = `${this.env.pos.format_currency(margin)} (${marginPercentage}%)`;
    const costSelector = '.section-financials-body table:nth-child(1) tr:nth-child(2) td:nth-child(2)';
    const marginSelector = '.section-financials-body table:nth-child(1) tr:nth-child(3) td:nth-child(2)';
    const costContent = this.target.querySelector(costSelector).textContent;
    const marginContent = this.target.querySelector(marginSelector).textContent;
    assert.strictEqual(costContent, expectedCost);
    assert.strictEqual(removeSpace(marginContent), expectedMargin);

    // since the previous assert already checked the value, there's no reason for the value to be randomly change
    // when changing config, so we'll only check for the appearances
    this.env.pos.get_cashier().role = 'manager';
    await testUtils.nextTick();
    assert.containsN(this.target, priceDetailSelector, 3);

    this.env.pos.config.is_margins_costs_accessible_to_every_user = false;
    await testUtils.nextTick();
    assert.containsN(this.target, priceDetailSelector, 3);
});


QUnit.test('Search/filter product variant', async function (assert) {

});

