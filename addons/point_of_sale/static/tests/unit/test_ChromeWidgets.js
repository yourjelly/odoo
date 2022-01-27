odoo.define('point_of_sale.tests.ChromeWidgets', function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const testUtils = require('web.test_utils');
    const makePosTestEnv = require('point_of_sale.test_env');
    const { getFixture, mount } = require('@web/../tests/helpers/utils');

    const { xml } = owl;

    let env;
    let target;
    QUnit.module('unit tests for Chrome Widgets', {
        beforeEach() {
            target = getFixture();
            env = makePosTestEnv();
        },
    });

    QUnit.test('CashierName', async function (assert) {
        assert.expect(1);

        class Parent extends PosComponent {}
        Parent.template = xml/* html */ `
            <div><CashierName></CashierName></div>
        `;
        env.pos.employee.name = 'Test Employee';

        await mount(Parent, { env, target });

        assert.strictEqual(target.querySelector('span.username').innerText, 'Test Employee');
    });

    QUnit.test('SyncNotification', async function (assert) {
        assert.expect(5);

        class Parent extends PosComponent {}
        Parent.env = makePosTestEnv();
        Parent.template = xml/* html */ `
            <div>
                <SyncNotification></SyncNotification>
            </div>
        `;

        const pos = env.pos;
        pos.set('synch', { status: 'connected', pending: false });

        await mount(Parent, { env, target });
        assert.ok(target.querySelector('i.fa').parentElement.classList.contains('js_connected'));

        pos.set('synch', { status: 'connecting', pending: false });
        await testUtils.nextTick();
        assert.ok(target.querySelector('i.fa').parentElement.classList.contains('js_connecting'));

        pos.set('synch', { status: 'disconnected', pending: false });
        await testUtils.nextTick();
        assert.ok(target.querySelector('i.fa').parentElement.classList.contains('js_disconnected'));

        pos.set('synch', { status: 'error', pending: false });
        await testUtils.nextTick();
        assert.ok(target.querySelector('i.fa').parentElement.classList.contains('js_error'));

        pos.set('synch', { status: 'error', pending: 10 });
        await testUtils.nextTick();
        assert.ok(target.querySelector('.js_msg').innerText.includes('10'));
    });
});
