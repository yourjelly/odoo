/** @odoo-module **/

import ProductInfoPopup from 'point_of_sale.ProductInfoPopup';
const { useBus } = require('@web/core/utils/hooks');
import { makePosTestEnv } from '../utils/test_env';
import { posServerData } from '../utils/test_server_data';
import { removeSpace, Root, overrideRoot } from '../utils/test_utils';
import testUtils from 'web.test_utils';
import { mount, click } from '@web/../tests/helpers/utils';
import { patchWithCleanup } from "@web/../tests/helpers/utils";
import { PosGlobalState, Order } from 'point_of_sale.models';

const TOTAL_PRICE_WITHOUT_TAX = 120;
const TOTAL_COST = 20;

let savedData = {};

QUnit.module('ProductInfoPopup Test', {
    async before() {
        const mockRPC = async (route, args) => {
            if (args.method === 'get_product_info_pos') {
                return savedData;
            }
        };

        this.env = await makePosTestEnv({ serverData: posServerData, mockRPC });

        patchWithCleanup(PosGlobalState.prototype, {
            _processData(loadedData) {
                loadedData['product.product'] = [{
                    "display_name": "Conference Chair (Steel)",
                    "lst_price": 33,
                    "standard_price": 5,
                    "barcode": '00000',
                    "default_code": "E-COM12",
                }];
                this._super(loadedData);
            }
        })
        await this.env.pos.load_server_data();
        this.product = Object.values(this.env.pos.db.product_by_id)[0];
        // we don't know which product we'll have so to make sure it has everything, we override some info
        this.props = { product: this.product, quantity: 1 };
        this.rootClass = Root; //Todo to remove not needed to be reactive for this component
        this.rootClass.template = owl.xml/* html */ `
            <t>
                <ProductInfoPopup t-props='props'/>
            </t>
        `;
        this.rootClass.components = { ProductInfoPopup };
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
                'forecasted_quantity': 25,
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
                    }, {
                        'name': 'Aluminium',
                        'search': 'Conference Chair Aluminium'
                    }
                ]
            }]
        };
        this.target = testUtils.prepareTarget();
    }
});

// Test all the things that should always be displayed regardless of config and data
QUnit.test('Component basic display', async function (assert) {
    patchWithCleanup(Order.prototype, {
        get_total_without_tax: () => TOTAL_PRICE_WITHOUT_TAX,
    });
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });

     // Product info titles
    const productNameContent = this.target.querySelector('.global-info-title.product-name').textContent;
    assert.strictEqual(productNameContent, 'Conference Chair (Steel)');

    const productPriceContent = this.target.querySelector('.global-info-title.product-price').textContent;
    assert.strictEqual(productPriceContent, '$ 45.31');

    const additionalInfoContent = this.target.querySelector('.global-info-title.product-name ~ span').textContent;
    assert.strictEqual(removeSpace(additionalInfoContent), 'E-COM12 - 00000');

    const taxDetailsContent = this.target.querySelector('.global-info-title.product-price ~ div').textContent;
    assert.strictEqual(removeSpace(taxDetailsContent), 'Tax 15%: $ 5.91');

    // Financial section
    const priceNoVATContent = this.target.querySelector('.section-financials-body table tr td:nth-child(2)').textContent;
    assert.strictEqual(priceNoVATContent, '$ 39.40');

    const pricelistSelector = '.section-financials-body table:nth-child(2) tr';
    const pricelistNameContent = this.target.querySelector(pricelistSelector + ' td').textContent;
    const pricelistPriceContent = this.target.querySelector(pricelistSelector + ' td:nth-child(2)').textContent;
    assert.strictEqual(pricelistNameContent, 'Public Pricelist');
    assert.strictEqual(pricelistPriceContent, '$ 39.40');

    // Order section
    const orderPriceNoVATContent = this.target.querySelector('.section-order-body table tr td:nth-child(2)').textContent;
    assert.strictEqual(orderPriceNoVATContent, '$ 120.00');
});


// ----------------
// Cost Margin in the financial section
// ----------------

QUnit.test('Cost Margin display in Financial section cashier with no access', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = false
    this.env.pos.get_cashier().role = 'cashier';
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    const priceDetailSelector = '.section-financials-body table:nth-child(1) tr';
    assert.containsN(this.target, priceDetailSelector, 1);
});

QUnit.test('Cost Margin display in Financial section cashier with access', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = true;
    this.env.pos.get_cashier().role = 'cashier';
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    const costSelector = '.section-financials-body table:nth-child(1) tr:nth-child(2) td:nth-child(2)';
    const marginSelector = '.section-financials-body table:nth-child(1) tr:nth-child(3) td:nth-child(2)';
    const costContent = this.target.querySelector(costSelector).textContent;
    const marginContent = this.target.querySelector(marginSelector).textContent;
    assert.strictEqual(costContent, '$ 5.00');
    assert.strictEqual(removeSpace(marginContent), '$ 34.40 (87.31%)');
});

// since the previous assert already checked the value, there's no reason for the value to be randomly changed
// when changing config, so we'll only check for the appearances
QUnit.test('Cost Margin display in Financial section manager with access', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = true;
    this.env.pos.get_cashier().role = 'manager';
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    const priceDetailSelector = '.section-financials-body table:nth-child(1) tr';
    assert.containsN(this.target, priceDetailSelector, 3);
});

QUnit.test('Cost Margin display in Financial section manager with no access', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = false;
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    const priceDetailSelector = '.section-financials-body table:nth-child(1) tr';
    assert.containsN(this.target, priceDetailSelector, 3);
});


// ----------------
// Inventory section
// ----------------

QUnit.test('Inventory section displayed', async function (assert) {
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    assert.containsOnce(this.target, '.section-inventory');

    const tableDataSelector = '.section-inventory .section-inventory-body table td';
    const warehouseNameContent = this.target.querySelector(tableDataSelector + ' span').textContent;
    assert.strictEqual(warehouseNameContent, 'San Francisco');

    const availableContent = this.target.querySelector(tableDataSelector + ':nth-child(2)').textContent;
    assert.ok(availableContent.includes('30 Units'));

    const forecastedContent = this.target.querySelector(tableDataSelector + ':nth-child(3)').textContent;
    assert.ok(forecastedContent.includes('25'));
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

    const supplierNameSelector = '.section-supplier .section-supplier-body table tr td span';
    const supplierNameContent = this.target.querySelector(supplierNameSelector).textContent;
    assert.strictEqual(supplierNameContent, 'Wood Corner');

    const lineSelector = '.section-supplier .section-supplier-body table tr .mobile-line td'
    const delayContent = this.target.querySelector(lineSelector).textContent;
    assert.ok(delayContent.includes('2'));
    const priceContent = this.target.querySelector(lineSelector + ':nth-child(2)').textContent;
    assert.strictEqual(priceContent, '$ 28.00');
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

    const tableDataSelector = '.section-variants .section-variants-body table tr td';
    const variantNameContent = this.target.querySelector(tableDataSelector + ' span').textContent;
    assert.strictEqual(variantNameContent, 'Legs');

    const variantValueContent1 = this.target.querySelector(tableDataSelector + ':nth-child(2) span').textContent;
    const variantValueContent2 = this.target.querySelector(tableDataSelector + ':nth-child(2) span:nth-child(2)').textContent;
    assert.strictEqual(variantValueContent1, 'Steel');
    assert.strictEqual(variantValueContent2, 'Aluminium');
});

QUnit.test('Variants section not displayed', async function (assert) {
    savedData['variants'] = [];
    await mount(this.rootClass, this.target, {env: this.env, props: this.props});
    assert.containsNone(this.target, '.section-variants');
});

QUnit.test('Search/filter product variant', async function (assert) {
    // When clicking on a product variant, it performs a search on the products list, the popup should then be closed
    const closeStep = 'close-popup';
    const ExtendedRoot = class ExtendedRoot extends Root {
        setup() {
            super.setup();
            useBus(this.env.posbus, 'search-product-from-info-popup', ({detail}) => assert.strictEqual(detail, 'Conference Chair Steel'));
            useBus(this.env.posbus, 'close-popup', () => assert.step(closeStep));
        }
    };
    assert.expect(3);

    await mount(ExtendedRoot, this.target, {env: this.env, props: this.props});
    await click(this.target.querySelector('.section-variants .section-variants-body table tr td:nth-child(2) span'));
    assert.verifySteps([closeStep]);
});


// ----------------
// Order section
// ----------------

QUnit.test('Cost Margin display in Order section', async function (assert) {
    this.env.pos.config.is_margins_costs_accessible_to_every_user = true;
    this.env.pos.get_cashier().role = 'manager';
    patchWithCleanup(Order.prototype, {
        get_total_without_tax: () => TOTAL_PRICE_WITHOUT_TAX,
        get_total_cost: () => TOTAL_COST,
    });
    await mount(this.rootClass, this.target, { env: this.env, props: this.props });
    const orderSelector = '.section-order .section-order-body table tr';
    assert.containsN(this.target, orderSelector, 3);

    const costContent = this.target.querySelector(orderSelector + ':nth-child(2) td:nth-child(2)').textContent;
    assert.strictEqual(costContent, '$ 20.00');

    const marginContent = this.target.querySelector(orderSelector + ':nth-child(3) td:nth-child(2)').textContent;
    assert.strictEqual(marginContent, '$ 100.00 (83.33%)');
});
