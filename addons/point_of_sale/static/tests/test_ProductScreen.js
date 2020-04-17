odoo.define('point_of_sale.tests.ProductScreen', async function (require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');
    const { useListener } = require('web.custom_hooks');
    const PopupControllerMixin = require('point_of_sale.PopupControllerMixin');
    const testUtils = require('web.test_utils');
    const { makePosTestEnv } = require('point_of_sale.test_setup_pos');
    const { xml } = owl.tags;
    const { useState } = owl;

    QUnit.module('ProductScreen and its child components', {});

    QUnit.test('ActionpadWidget', async function (assert) {
        assert.expect(7);

        // Extension that will be used to patch showScreen and showTempScreen methods
        const MockedShowScreenExt = (X) =>
            class extends X {
                showScreen(screenName) {
                    assert.step(screenName);
                }
                async showTempScreen(screenName) {
                    assert.step(screenName);
                }
            };

        // extend ActionpadWidget to mock its showScreen and showTempScreen
        const extension = Registries.Component.extend('ActionpadWidget', MockedShowScreenExt);
        extension.compile();

        class Parent extends PosComponent {}
        Parent.env = makePosTestEnv();
        Parent.template = xml/* html */ `
            <div><ActionpadWidget></ActionpadWidget></div>
        `;

        const currentOrder = Parent.env.pos.get_order();

        const parent = new Parent();
        await parent.mount(testUtils.prepareTarget());

        const setCustomerButton = parent.el.querySelector('button.set-customer');
        const payButton = parent.el.querySelector('button.pay');

        // start with no customer
        currentOrder.set_client(null);
        await testUtils.nextTick();
        assert.ok(setCustomerButton.innerText.includes('Customer'));

        // change to customer with short name
        currentOrder.set_client({ name: 'Test' });
        await testUtils.nextTick();
        assert.ok(setCustomerButton.innerText.includes('Test'));

        // change to customer with long name
        currentOrder.set_client({ name: 'Change Customer' });
        await testUtils.nextTick();
        assert.ok(setCustomerButton.classList.contains('decentered'));

        currentOrder.set_client(null);

        // click set-customer button
        await testUtils.dom.click(setCustomerButton);
        await testUtils.nextTick();
        assert.verifySteps(['ClientListScreen']);

        // click pay button
        await testUtils.dom.click(payButton);
        await testUtils.nextTick();
        assert.verifySteps(['PaymentScreen']);

        // remove the extension
        // calling remove on the extension also recomputes
        // the extended class.
        extension.remove();

        parent.unmount();
        parent.destroy();
    });

    QUnit.test('NumpadWidget', async function (assert) {
        assert.expect(23);

        class Parent extends PosComponent {
            constructor() {
                super(...arguments);
                useListener('set-numpad-mode', this.setNumpadMode);
                useListener('numpad-click-input', this.numpadClickInput);
            }
            setNumpadMode({ detail: { mode } }) {
                assert.step(mode);
            }
            numpadClickInput({ detail: { key } }) {
                assert.step(key);
            }
        }
        Parent.env = makePosTestEnv();
        Parent.template = xml/* html */ `
            <div><NumpadWidget></NumpadWidget></div>
        `;

        const pos = Parent.env.pos;
        // set this old values back after testing
        const old_config = pos.config;
        const old_cashier = pos.get('cashier');

        // set dummy values in pos.config and pos.get('cashier')
        pos.config = {
            restrict_price_control: false,
        };
        pos.set('cashier', { role: 'manager' });

        const parent = new Parent();
        await parent.mount(testUtils.prepareTarget());

        const modeButtons = parent.el.querySelectorAll('.mode-button');
        let qtyButton, discButton, priceButton;
        for (let button of modeButtons) {
            if (button.textContent.includes('Qty')) {
                qtyButton = button;
            }
            if (button.textContent.includes('Disc')) {
                discButton = button;
            }
            if (button.textContent.includes('Price')) {
                priceButton = button;
            }
        }

        // initially, qty button is active
        assert.ok(qtyButton.classList.contains('selected-mode'));
        assert.ok(!discButton.classList.contains('selected-mode'));
        assert.ok(!priceButton.classList.contains('selected-mode'));

        await testUtils.dom.click(discButton);
        await testUtils.nextTick();
        assert.ok(!qtyButton.classList.contains('selected-mode'));
        assert.ok(discButton.classList.contains('selected-mode'));
        assert.ok(!priceButton.classList.contains('selected-mode'));
        assert.verifySteps(['discount']);

        await testUtils.dom.click(priceButton);
        await testUtils.nextTick();
        assert.ok(!qtyButton.classList.contains('selected-mode'));
        assert.ok(!discButton.classList.contains('selected-mode'));
        assert.ok(priceButton.classList.contains('selected-mode'));
        assert.verifySteps(['price']);

        const numpadOne = [...parent.el.querySelectorAll('.number-char').values()].find((el) =>
            el.textContent.includes('1')
        );
        const numpadMinus = parent.el.querySelector('.numpad-minus');
        const numpadBackspace = parent.el.querySelector('.numpad-backspace');

        await testUtils.dom.click(numpadOne);
        await testUtils.nextTick();
        assert.verifySteps(['1']);

        await testUtils.dom.click(numpadMinus);
        await testUtils.nextTick();
        assert.verifySteps(['-']);

        await testUtils.dom.click(numpadBackspace);
        await testUtils.nextTick();
        assert.verifySteps(['Backspace']);

        await testUtils.dom.click(priceButton);
        await testUtils.nextTick();
        assert.verifySteps(['price']);

        // change to price control restriction and the cashier is not manager
        pos.config.restrict_price_control = true;
        pos.set('cashier', { role: 'not manager' });
        await testUtils.nextTick();

        assert.ok(priceButton.classList.contains('disabled-mode'));
        assert.ok(qtyButton.classList.contains('selected-mode'));

        // reset old config and cashier values to pos
        pos.config = old_config;
        pos.set('cashier', old_cashier);

        parent.unmount();
        parent.destroy();
    });

    QUnit.test('ProductsWidgetControlPanel', async function (assert) {
        assert.expect(32);

        // This test incorporates the following components:
        // CategoryBreadcrumb
        // CategoryButton
        // CategorySimpleButton
        // HomeCategoryBreadcrumb

        // Create dummy category data
        //
        // Root
        //   | Test1
        //   |   | Test2
        //   |   ` Test3
        //   |       | Test5
        //   |       ` Test6
        //   ` Test4

        const rootCategory = { id: 0, name: 'Root', parent: null };
        const testCategory1 = { id: 1, name: 'Test1', parent: 0 };
        const testCategory2 = { id: 2, name: 'Test2', parent: 1 };
        const testCategory3 = { id: 3, name: 'Test3', parent: 1 };
        const testCategory4 = { id: 4, name: 'Test4', parent: 0 };
        const testCategory5 = { id: 5, name: 'Test5', parent: 3 };
        const testCategory6 = { id: 6, name: 'Test6', parent: 3 };
        const categories = {
            0: rootCategory,
            1: testCategory1,
            2: testCategory2,
            3: testCategory3,
            4: testCategory4,
            5: testCategory5,
            6: testCategory6,
        };

        class Parent extends PosComponent {
            constructor() {
                super(...arguments);
                this.state = useState({ selectedCategoryId: 0 });
                useListener('switch-category', this.switchCategory);
                useListener('update-search', this.updateSearch);
                useListener('clear-search', this.clearSearch);
            }
            get breadcrumbs() {
                if (this.state.selectedCategoryId === 0) return [];
                let current = categories[this.state.selectedCategoryId];
                const res = [current];
                while (current.parent != 0) {
                    const toAdd = categories[current.parent];
                    res.push(toAdd);
                    current = toAdd;
                }
                return res.reverse();
            }
            get subcategories() {
                return Object.values(categories).filter(
                    ({ parent }) => parent == this.state.selectedCategoryId
                );
            }
            switchCategory({ detail: id }) {
                this.state.selectedCategoryId = id;
                assert.step(`${id}`);
            }
            updateSearch(event) {
                assert.step(event.detail);
            }
            clearSearch() {
                assert.step('cleared');
            }
        }
        Parent.env = makePosTestEnv();
        Parent.template = xml/* html */ `
            <div>
                <ProductsWidgetControlPanel breadcrumbs="breadcrumbs" subcategories="subcategories" />
            </div>
        `;

        const pos = Parent.env.pos;
        const old_config = pos.config;
        // set dummy config
        pos.config = { iface_display_categ_images: false };

        const parent = new Parent();
        await parent.mount(testUtils.prepareTarget());

        // The following tests the breadcrumbs and subcategory buttons

        // check if HomeCategoryBreadcrumb is rendered
        assert.ok(
            parent.el.querySelector('.breadcrumb-home'),
            'Home category should always be there'
        );
        let subcategorySpans = [...parent.el.querySelectorAll('.category-simple-button')];
        assert.ok(subcategorySpans.length === 2, 'There should be 2 subcategories for Root.');
        assert.ok(subcategorySpans.find((span) => span.textContent.includes('Test1')));
        assert.ok(subcategorySpans.find((span) => span.textContent.includes('Test4')));

        // click Test1
        let test1Span = subcategorySpans.find((span) => span.textContent.includes('Test1'));
        await testUtils.dom.click(test1Span);
        await testUtils.nextTick();
        assert.verifySteps(['1']);
        assert.ok(
            [...parent.el.querySelectorAll('.breadcrumb-button')][1].textContent.includes('Test1')
        );
        subcategorySpans = [...parent.el.querySelectorAll('.category-simple-button')];
        assert.ok(subcategorySpans.length === 2, 'There should be 2 subcategories for Root.');
        assert.ok(subcategorySpans.find((span) => span.textContent.includes('Test2')));
        assert.ok(subcategorySpans.find((span) => span.textContent.includes('Test3')));

        // click Test2
        let test2Span = subcategorySpans.find((span) => span.textContent.includes('Test2'));
        await testUtils.dom.click(test2Span);
        await testUtils.nextTick();
        assert.verifySteps(['2']);
        subcategorySpans = [...parent.el.querySelectorAll('.category-simple-button')];
        assert.ok(subcategorySpans.length === 0, 'Test2 should not have subcategories');

        // go back to Test1
        let breadcrumb1 = [...parent.el.querySelectorAll('.breadcrumb-button')].find((el) =>
            el.textContent.includes('Test1')
        );
        await testUtils.dom.click(breadcrumb1);
        await testUtils.nextTick();
        assert.verifySteps(['1']);

        // click Test3
        subcategorySpans = [...parent.el.querySelectorAll('.category-simple-button')];
        let test3Span = subcategorySpans.find((span) => span.textContent.includes('Test3'));
        await testUtils.dom.click(test3Span);
        await testUtils.nextTick();
        assert.verifySteps(['3']);
        subcategorySpans = [...parent.el.querySelectorAll('.category-simple-button')];
        assert.ok(subcategorySpans.length === 2);

        // click Test6
        let test6Span = subcategorySpans.find((span) => span.textContent.includes('Test6'));
        await testUtils.dom.click(test6Span);
        await testUtils.nextTick();
        assert.verifySteps(['6']);
        let breadcrumbButtons = [...parent.el.querySelectorAll('.breadcrumb-button')];
        assert.ok(breadcrumbButtons.length === 4);

        // Now check subcategory buttons with images
        pos.config.iface_display_categ_images = true;

        let breadcrumbHome = parent.el.querySelector('.breadcrumb-home');
        await testUtils.dom.click(breadcrumbHome);
        await testUtils.nextTick();
        assert.verifySteps(['0']);
        assert.ok(
            !parent.el.querySelector('.category-list').classList.contains('simple'),
            'Category list should not have simple class'
        );
        let categoryButtons = [...parent.el.querySelectorAll('.category-button')];
        assert.ok(categoryButtons.length === 2, 'There should be 2 subcategories for Root');

        // The following tests the search bar

        const wait = (ms) => {
            return new Promise((resolve) => {
                setTimeout(resolve, ms);
            });
        };

        const inputEl = parent.el.querySelector('.searchbox input');
        await testUtils.dom.triggerEvent(inputEl, 'keyup', { key: 'A' });
        // triggering keyup event doesn't type the key to the input
        // so we manually assign the value of the input.
        inputEl.value = 'A';
        await wait(30);
        await testUtils.dom.triggerEvent(inputEl, 'keyup', { key: 'B' });
        inputEl.value = 'AB';
        await wait(30);
        await testUtils.dom.triggerEvent(inputEl, 'keyup', { key: 'C' });
        inputEl.value = 'ABC';
        await wait(110);
        // only after waiting for more than 100ms that update-search is trigger
        // because the method is debounced.
        assert.verifySteps(['ABC']);
        await testUtils.dom.triggerEvent(inputEl, 'keyup', { key: 'D' });
        inputEl.value = 'ABCD';
        await wait(110);
        assert.verifySteps(['ABCD']);

        // clear the search bar
        await testUtils.dom.click(parent.el.querySelector('.search-clear.right'));
        await testUtils.nextTick();
        assert.verifySteps(['cleared']);
        assert.ok(inputEl.value === '', 'value of the input element should be empty');

        pos.config = old_config;

        parent.unmount();
        parent.destroy();
    });
});
