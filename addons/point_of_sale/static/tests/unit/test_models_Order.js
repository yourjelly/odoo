odoo.define('point_of_sale.test_models_Order', function (require) {
    'use strict';

    const models = require('point_of_sale.models');
    const makePosTestEnv = require('point_of_sale.test_env');
    const env = require('web.env');

    QUnit.module('unit tests for models.Order', {});

    /**
     * It is important to have the following receipt env properties to be the same
     * for the 'original models.Order' and 'reconstructed models.Order' from backend.
     * - orderlines
     * - payments
     * - and other properties
     */
    function compareReceiptEnvs(assert, originalEnv, recreatedEnv) {
        // IMPROVEMENT: How about tax_details?
        // compare orderlines
        const origOrderlines = originalEnv.receipt.orderlines;
        const reconsOrderlines = recreatedEnv.receipt.orderlines;
        for (let orderline of origOrderlines) {
            let counterpart = reconsOrderlines.find(
                (line) => line.product_name === orderline.product_name
            );
            delete counterpart.id;
            delete orderline.id;
            assert.deepEqual(orderline, counterpart, 'orderline equal');
        }

        // compare paymentlines
        const origPaymentlines = originalEnv.receipt.paymentlines;
        const reconsPaymentlines = recreatedEnv.receipt.paymentlines;
        for (let paymentline of origPaymentlines) {
            let counterpart = reconsPaymentlines.find(
                (line) => line.name === paymentline.name && line.amount === paymentline.amount
            );
            delete counterpart.cid;
            delete paymentline.cid;
            assert.deepEqual(paymentline, counterpart, 'paymentline equal');
        }

        // compare other props
        const otherProps = [
            'name',
            'change',
            'rounding_applied',
            'subtotal',
            'total_discount',
            'total_rounded',
            'total_tax',
            'total_with_tax',
            'total_without_tax',
        ];
        for (let prop of otherProps) {
            assert.strictEqual(
                originalEnv.receipt[prop],
                recreatedEnv.receipt[prop],
                `'${prop}' should be equal`
            );
        }
    }

    QUnit.test('similar receipt env before and after sync, single payment line', async function (
        assert
    ) {
        assert.expect(12);
        const test_env = makePosTestEnv();
        const pos = test_env.pos;
        pos.rpc = env.services.rpc;

        // create the order then sync to server
        const currentOrder = pos.get_order();
        const product1 = Object.values(pos.db.product_by_id)[0];
        const product2 = Object.values(pos.db.product_by_id)[1];
        const partnerId = pos.db.partner_sorted[0];
        const partner = pos.db.partner_by_id[partnerId];
        const bankPaymentMethod = pos.payment_methods.find((method) => !method.is_cash_count);
        currentOrder.add_product(product1);
        currentOrder.add_product(product2);
        currentOrder.set_client(partner);
        currentOrder.add_paymentline(bankPaymentMethod);
        currentOrder.initialize_validation_date();
        currentOrder.finalized = true;
        const originalReceiptEnv = currentOrder.getOrderReceiptEnv();
        const syncedOrderBackendIds = await pos.push_single_order(currentOrder);

        // fetch and recreate the synced order
        const [orderObj] = await env.services.rpc({
            model: 'pos.order',
            method: 'export_for_ui',
            args: [syncedOrderBackendIds],
            context: env.session.user_context,
        });
        const syncedOrder = new models.Order({}, { pos, json: orderObj });
        const recreatedReceiptEnv = syncedOrder.getOrderReceiptEnv();

        compareReceiptEnvs(assert, originalReceiptEnv, recreatedReceiptEnv);

        currentOrder.destroy();
        syncedOrder.destroy();
    });

    QUnit.test('similar receipt env before and after sync, multiple payments 1', async function (
        assert
    ) {
        assert.expect(14);
        const test_env = makePosTestEnv();
        const pos = test_env.pos;
        pos.rpc = env.services.rpc;

        // create the order then sync to server
        const currentOrder = pos.get_order();
        const product3 = Object.values(pos.db.product_by_id)[3];
        const product2 = Object.values(pos.db.product_by_id)[2];
        const product0 = Object.values(pos.db.product_by_id)[0];
        const partnerId = pos.db.partner_sorted[1];
        const partner = pos.db.partner_by_id[partnerId];
        const bankPaymentMethod = pos.payment_methods.find((method) => !method.is_cash_count);
        const cashPaymentMethod = pos.payment_methods.find((method) => method.is_cash_count);
        currentOrder.add_product(product3, { quantity: 1.5, price: 5.2 });
        currentOrder.add_product(product2, { quantity: 6, price: 3.3 });
        currentOrder.add_product(product0, { quantity: 3.1, price: 5.5 });
        currentOrder.set_client(partner);
        currentOrder.add_paymentline(cashPaymentMethod);
        currentOrder.selected_paymentline.set_amount(25);
        currentOrder.add_paymentline(bankPaymentMethod);
        currentOrder.selected_paymentline.set_amount(25);
        currentOrder.initialize_validation_date();
        currentOrder.finalized = true;
        const originalReceiptEnv = currentOrder.getOrderReceiptEnv();
        const syncedOrderBackendIds = await pos.push_single_order(currentOrder);

        // fetch and recreate the synced order
        const [orderObj] = await env.services.rpc({
            model: 'pos.order',
            method: 'export_for_ui',
            args: [syncedOrderBackendIds],
            context: env.session.user_context,
        });
        const syncedOrder = new models.Order({}, { pos, json: orderObj });
        const recreatedReceiptEnv = syncedOrder.getOrderReceiptEnv();

        compareReceiptEnvs(assert, originalReceiptEnv, recreatedReceiptEnv);

        currentOrder.destroy();
        syncedOrder.destroy();
    });

    QUnit.test('similar receipt env before and after sync, multiple payments 2', async function (
        assert
    ) {
        assert.expect(15);
        const test_env = makePosTestEnv();
        const pos = test_env.pos;
        pos.rpc = env.services.rpc;

        // create the order then sync to server
        const currentOrder = pos.get_order();
        const product3 = Object.values(pos.db.product_by_id)[3];
        const product2 = Object.values(pos.db.product_by_id)[2];
        const product1 = Object.values(pos.db.product_by_id)[1];
        const product0 = Object.values(pos.db.product_by_id)[0];
        const partnerId = pos.db.partner_sorted[2];
        const partner = pos.db.partner_by_id[partnerId];
        const bankPaymentMethod = pos.payment_methods.find((method) => !method.is_cash_count);
        const cashPaymentMethod = pos.payment_methods.find((method) => method.is_cash_count);
        currentOrder.add_product(product2, { quantity: 1.5, price: 5.1 });
        currentOrder.add_product(product3, { quantity: 6.7, price: 3.3 });
        currentOrder.add_product(product1, { quantity: 12.9, price: 8.7 });
        currentOrder.add_product(product0, { quantity: 3.5, price: 5.3 });
        currentOrder.set_client(partner);
        currentOrder.add_paymentline(cashPaymentMethod);
        currentOrder.selected_paymentline.set_amount(100);
        currentOrder.add_paymentline(bankPaymentMethod);
        currentOrder.selected_paymentline.set_amount(100);
        currentOrder.initialize_validation_date();
        currentOrder.finalized = true;
        const originalReceiptEnv = currentOrder.getOrderReceiptEnv();
        const syncedOrderBackendIds = await pos.push_single_order(currentOrder);

        // fetch and recreate the synced order
        const [orderObj] = await env.services.rpc({
            model: 'pos.order',
            method: 'export_for_ui',
            args: [syncedOrderBackendIds],
            context: env.session.user_context,
        });
        const syncedOrder = new models.Order({}, { pos, json: orderObj });
        const recreatedReceiptEnv = syncedOrder.getOrderReceiptEnv();

        compareReceiptEnvs(assert, originalReceiptEnv, recreatedReceiptEnv);

        currentOrder.destroy();
        syncedOrder.destroy();
    });
});
