/** @odoo-module **/

import PosComponent from 'point_of_sale.PosComponent';
import ProductInfoPopup from 'point_of_sale.ProductInfoPopup';
const { useBus } = require('@web/core/utils/hooks');
import { makePosTestEnv } from '../utils/test_env';
import { posServerData } from '../utils/test_server_data';
import { removeSpace } from '../utils/test_utils';
import testUtils from 'web.test_utils';
import { mount, click } from '@web/../tests/helpers/utils';
import { ormService } from '@web/core/orm_service';
import { registry } from '@web/core/registry';
import { batched } from 'point_of_sale.utils';

const serviceRegistry = registry.category('services');
const ADDED_PRICE = 60;
const ADDED_COST = 20;
let savedData = {};

QUnit.module('ProductInfoPopup Test', {
    async before() {
        this.mockRPC = async (route, args) => {
            if (args.method === 'get_product_info_pos') {
                return savedData;
            }
        };

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
        this.createDummyComponent = (mixin) => {
          return mixin(this.rootClass);
        }

        // TODO patch is not working, it loops infinitely on reactive object during mount
        // testUtils.mock.patch(Order.prototype, {
        //     get_total_without_tax: () => {
        //         return savedData['all_prices']['price_without_tax'] + ADDED_PRICE;
        //     }
        // })

        serviceRegistry.add('orm', ormService);
        this.env = await makePosTestEnv({ serverData: posServerData, mockRPC: this.mockRPC });
        await this.env.pos.load_server_data();
        this.product = Object.values(this.env.pos.db.product_by_id)[0];
        // we don't know which product we'll have so to make sure it has everything, we override some info
        this.product.barcode = this.product.barcode || '00000';
        this.product.default_code = this.product.default_code || 'E-COM01';
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
        this.target = testUtils.prepareTarget();

        this.rootClass.template = owl.xml/* html */ `
            <t>
                <ProductInfoPopup t-props='props'/>
            </t>
        `;
        this.rootClass.components = { ProductInfoPopup };
    }
});

// Test all the things that should always be displayed regardless of config and data
QUnit.test('Component basic display', async function (assert) {
    const order = this.env.pos.get_order()
    // mocking a method
    order.get_total_without_tax = () => savedData['all_prices']['price_without_tax'] + ADDED_PRICE;
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });

     // Product info titles
    const productNameContent = this.target.querySelector('.global-info-title.product-name').textContent;
    assert.strictEqual(productNameContent, this.product.display_name);

    const productPriceContent = this.target.querySelector('.global-info-title.product-price').textContent;
    assert.strictEqual(productPriceContent, this.env.pos.format_currency(savedData['all_prices']['price_with_tax']));

    const additionalInfoContent = this.target.querySelector('.global-info-title.product-name ~ span').textContent;
    assert.strictEqual(removeSpace(additionalInfoContent), `${this.product.default_code} - ${this.product.barcode}`);

    const taxDetailsContent = this.target.querySelector('.global-info-title.product-price ~ div').textContent;
    const expectedTaxName = savedData['all_prices']['tax_details'][0]['name'];
    const expectedTaxAmount = this.env.pos.format_currency(savedData['all_prices']['tax_details'][0]['amount']);
    assert.strictEqual(removeSpace(taxDetailsContent), `${expectedTaxName}: ${expectedTaxAmount}`);

    // Financial section
    const priceNoVATContent = this.target.querySelector('.section-financials-body table tr td:nth-child(2)').textContent;
    assert.strictEqual(priceNoVATContent, this.env.pos.format_currency(savedData['all_prices']['price_without_tax']));

    const pricelistSelector = '.section-financials-body table:nth-child(2) tr';
    const pricelistNameContent = this.target.querySelector(pricelistSelector + ' td').textContent;
    const pricelistPriceContent = this.target.querySelector(pricelistSelector + ' td:nth-child(2)').textContent;
    assert.strictEqual(pricelistNameContent, savedData['pricelists'][0]['name']);
    assert.strictEqual(pricelistPriceContent, this.env.pos.format_currency(savedData['pricelists'][0]['price']));

    // Order section
    const expectedTotalWithoutTax = this.env.pos.format_currency(this.env.pos.get_order().get_total_without_tax());
    const orderPriceNoVATContent = this.target.querySelector('.section-order-body table tr td:nth-child(2)').textContent;
    assert.strictEqual(orderPriceNoVATContent, expectedTotalWithoutTax);
});


// ----------------
// Cost Margin in the financial section
// ----------------

const priceDetailSelector = '.section-financials-body table:nth-child(1) tr';
QUnit.test('Cost Margin display in Financial section cashier with no access', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = false
    this.env.pos.get_cashier().role = 'cashier';
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    assert.containsN(this.target, priceDetailSelector, 1);
});

QUnit.test('Cost Margin display in Financial section cashier with access', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = true;
    this.env.pos.get_cashier().role = 'cashier';
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    const expectedCost = this.env.pos.format_currency(this.product.standard_price);
    const margin = savedData['all_prices']['price_without_tax'] - this.product.standard_price;
    const marginPercentage = savedData['all_prices']['price_without_tax'] ? Math.round(margin/savedData['all_prices']['price_without_tax'] * 10000) / 100 : 0;
    const expectedMargin = `${this.env.pos.format_currency(margin)} (${marginPercentage}%)`;
    const costSelector = '.section-financials-body table:nth-child(1) tr:nth-child(2) td:nth-child(2)';
    const marginSelector = '.section-financials-body table:nth-child(1) tr:nth-child(3) td:nth-child(2)';
    const costContent = this.target.querySelector(costSelector).textContent;
    const marginContent = this.target.querySelector(marginSelector).textContent;
    assert.strictEqual(costContent, expectedCost);
    assert.strictEqual(removeSpace(marginContent), expectedMargin);
});

// since the previous assert already checked the value, there's no reason for the value to be randomly changed
// when changing config, so we'll only check for the appearances
QUnit.test('Cost Margin display in Financial section manager with access', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = true;
    this.env.pos.get_cashier().role = 'manager';
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    assert.containsN(this.target, priceDetailSelector, 3);
});

QUnit.test('Cost Margin display in Financial section manager with no access', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = false;
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    assert.containsN(this.target, priceDetailSelector, 3);
});


// ----------------
// Inventory section
// ----------------

QUnit.test('Inventory section displayed', async function (assert) {
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    assert.containsOnce(this.target, '.section-inventory');

    const warehouseData = savedData['warehouses'][0];
    const tableDataSelector = '.section-inventory .section-inventory-body table td';
    const warehouseNameContent = this.target.querySelector(tableDataSelector + ' span').textContent;
    assert.strictEqual(warehouseNameContent, warehouseData['name']);

    const availableContent = this.target.querySelector(tableDataSelector + ':nth-child(2)').textContent;
    assert.ok(availableContent.includes(`${warehouseData['available_quantity']} ${warehouseData['uom']}`));

    const forecastedContent = this.target.querySelector(tableDataSelector + ':nth-child(3)').textContent;
    assert.ok(forecastedContent.includes(warehouseData['forecasted_quantity']));
});

QUnit.test('Inventory section not displayed', async function (assert) {
    savedData['warehouses'] = [];
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    assert.containsNone(this.target, '.section-inventory');
});


// ----------------
// Supplier section
// ----------------

// Not going to test all the config combination, it has already been done during the margin cost in the financial section
QUnit.test('Supplier section displayed with manager/access', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = true;
    this.env.pos.get_cashier().role = 'manager';
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    assert.containsOnce(this.target, '.section-supplier');

    const supplierData = savedData['suppliers'][0];
    const supplierNameSelector = '.section-supplier .section-supplier-body table tr td span';
    const supplierNameContent = this.target.querySelector(supplierNameSelector).textContent;
    assert.strictEqual(supplierNameContent, supplierData['name']);

    const lineSelector = '.section-supplier .section-supplier-body table tr .mobile-line td'
    const delayContent = this.target.querySelector(lineSelector).textContent;
    assert.ok(delayContent.includes(supplierData['delay']));
    const priceContent = this.target.querySelector(lineSelector + ':nth-child(2)').textContent;
    assert.strictEqual(priceContent, this.env.pos.format_currency(supplierData['price']));
});

QUnit.test('Supplier section price not displayed', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = false;
    this.env.pos.get_cashier().role = 'cashier';
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    assert.containsN(this.target, '.section-supplier .section-supplier-body table tr td', 2);
});

QUnit.test('Supplier section not displayed', async function (assert) {
    savedData['suppliers'] = [];
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    assert.containsNone(this.target, '.section-supplier');
})


// ----------------
// Extra section variant
// ----------------

QUnit.test('Variants section displayed', async function (assert) {
    await mount(this.rootClass, this.target, {env: this.env, props: this.props});
    assert.containsOnce(this.target, '.section-variants');

    const variantsData = savedData['variants'][0];
    const tableDataSelector = '.section-variants .section-variants-body table tr td';
    const variantNameContent = this.target.querySelector(tableDataSelector + ' span').textContent;
    assert.strictEqual(variantNameContent, variantsData['name']);

    const variantValueContent1 = this.target.querySelector(tableDataSelector + ':nth-child(2) span').textContent;
    const variantValueContent2 = this.target.querySelector(tableDataSelector + ':nth-child(2) span:nth-child(2)').textContent;
    assert.strictEqual(variantValueContent1, variantsData['values'][0]['name']);
    assert.strictEqual(variantValueContent2, variantsData['values'][1]['name']);
});

QUnit.test('Variants section not displayed', async function (assert) {
    savedData['variants'] = [];
    await mount(this.rootClass, this.target, {env: this.env, props: this.props});
    assert.containsNone(this.target, '.section-variants');
});

QUnit.test('Search/filter product variant', async function (assert) {
    // When clicking on a product variant, it performs a search on the products list, the popup should then be closed
    const step1 = 'trigger-search';
    const step2 = 'close-popup';
    const ExtendedRoot = this.createDummyComponent(Root => class ExtendedRoot extends Root {
        setup() {
            super.setup();
            useBus(this.env.posbus, 'search-product-from-info-popup', () => assert.step(step1));
            useBus(this.env.posbus, 'close-popup', () => assert.step(step2));
        }
    });

    await mount(ExtendedRoot, this.target, {env: this.env, props: this.props});
    await click(this.target.querySelector('.section-variants .section-variants-body table tr td:nth-child(2) span'))
    assert.verifySteps([step1, step2]);
});


// ----------------
// Order section
// ----------------

QUnit.test('Cost Margin display in Order section', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = true;
    this.env.pos.get_cashier().role = 'manager';
    const order = this.env.pos.get_order();
    order.get_total_without_tax = () => savedData['all_prices']['price_without_tax'] + ADDED_PRICE;
    order.get_total_cost = () => this.product.standard_price + ADDED_COST;
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    const orderSelector = '.section-order .section-order-body table tr';
    assert.containsN(this.target, orderSelector, 3);

    const costContent = this.target.querySelector(orderSelector + ':nth-child(2) td:nth-child(2)').textContent;
    const expectedCost = order.get_total_cost();
    assert.strictEqual(costContent, this.env.pos.format_currency((expectedCost)));

    const marginContent = this.target.querySelector(orderSelector + ':nth-child(3) td:nth-child(2)').textContent;
    const priceWithoutTax = order.get_total_without_tax();
    const expectedMargin = priceWithoutTax - expectedCost;
    const expectMarginPercent = Math.round(expectedMargin/priceWithoutTax * 10000) / 100;
    assert.strictEqual(marginContent, `${this.env.pos.format_currency(expectedMargin)} (${expectMarginPercent}%)`);
});
