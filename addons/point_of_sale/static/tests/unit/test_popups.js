odoo.define('point_of_sale.test_popups', async function(require) {
    'use strict';

    const Registries = require('point_of_sale.Registries');
    const makeTestEnvironment = require('web.test_env');
    const testUtils = require('web.test_utils');
    const PosComponent = require('point_of_sale.PosComponent');
    const PopupControllerMixin = require('point_of_sale.PopupControllerMixin');
    const { xml } = owl.tags;

    QUnit.module('Test Pos Popups', {
        before() {
            class Root extends PopupControllerMixin(PosComponent) {
                static template = xml`
                    <div>
                        <t t-if="popup.isShown" t-component="popup.component" t-props="popupProps" t-key="popup.name" />
                    </div>
                `;
            }
            Root.env = makeTestEnvironment();
            this.Root = Root;
            Registries.Component.freeze();
        },
    });

    QUnit.test('ConfirmPopup', async function(assert) {
        assert.expect(6);

        const root = new this.Root();
        await root.mount(testUtils.prepareTarget());

        let promResponse, userResponse;

        // Step: show popup and confirm
        promResponse = root.showPopup('ConfirmPopup', {});
        await testUtils.nextTick();
        testUtils.dom.click(root.el.querySelector('.confirm'));
        await testUtils.nextTick();
        userResponse = await promResponse;
        assert.strictEqual(userResponse.confirmed, true);

        // Step: show popup then cancel
        promResponse = root.showPopup('ConfirmPopup', {});
        await testUtils.nextTick();
        testUtils.dom.click(root.el.querySelector('.cancel'));
        await testUtils.nextTick();
        userResponse = await promResponse;
        assert.strictEqual(userResponse.confirmed, false);

        // Step: check texts
        promResponse = root.showPopup('ConfirmPopup', {
            title: 'Are you sure?',
            body: 'Are you having fun?',
            confirmText: 'Hell Yeah!',
            cancelText: 'Are you kidding me?',
        });
        await testUtils.nextTick();
        assert.strictEqual(root.el.querySelector('.title').innerText.trim(), 'Are you sure?');
        assert.strictEqual(root.el.querySelector('.body').innerText.trim(), 'Are you having fun?');
        assert.strictEqual(root.el.querySelector('.confirm').innerText.trim(), 'Hell Yeah!');
        assert.strictEqual(
            root.el.querySelector('.cancel').innerText.trim(),
            'Are you kidding me?'
        );

        root.unmount();
        root.destroy();
    });
});
