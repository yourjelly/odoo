odoo.define('mail/static/src/components/composer_drop_list_suggestion/composer_drop_list_suggestion_canned_response_tests.js', function (require) {
'use strict';

const components = {
    ComposerDropListSuggestion: require('mail/static/src/components/composer_drop_list_suggestion/composer_drop_list_suggestion.js'),
};
const {
    afterEach: utilsAfterEach,
    beforeEach: utilsBeforeEach,
    start: utilsStart,
} = require('mail/static/src/utils/test_utils.js');

QUnit.module('mail', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('composer_drop_list_suggestion', {}, function () {
QUnit.module('composer_drop_list_suggestion_canned_response_tests.js', {
    beforeEach() {
        utilsBeforeEach(this);
        this.createCannedResponseSuggestion = async cannedResponse => {
            const CannedResponseSuggestionComponent = components.ComposerDropListSuggestion;
            CannedResponseSuggestionComponent.env = this.env;
            this.component = new CannedResponseSuggestionComponent(
                null,
                {
                    isActive: true,
                    modelName: 'mail.canned_response',
                    recordLocalId: cannedResponse.localId,
                });
            await this.component.mount(this.widget.el);
        };
        this.start = async params => {
            let { env, widget } = await utilsStart(Object.assign({}, params, {
                data: this.data,
            }));
            this.env = env;
            this.widget = widget;
        };
    },
    afterEach() {
        utilsAfterEach(this);
        if (this.component) {
            this.component.destroy();
        }
        if (this.widget) {
            this.widget.destroy();
        }
        this.env = undefined;
        delete components.ComposerDropListSuggestion.env;
    },
});

QUnit.test('canned response suggestion displayed', async function (assert) {
    assert.expect(1);

    await this.start();
    const cannedResponse = this.env.models['mail.canned_response'].create({
        id: 7,
        source: 'hello',
        substitution: "Hello, how are you?",
    });
    await this.createCannedResponseSuggestion(cannedResponse);

    assert.containsOnce(
        document.body,
        `.o_ComposerDropListSuggestion`,
        "Canned response suggestion should be present"
    );
});

QUnit.test('canned response suggestion correct data', async function (assert) {
    assert.expect(5);

    await this.start();
    const cannedResponse = this.env.models['mail.canned_response'].create({
        id: 7,
        source: 'hello',
        substitution: "Hello, how are you?",
    });
    await this.createCannedResponseSuggestion(cannedResponse);

    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion',
        "Canned response suggestion should be present"
    );
    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion_part1',
        "Canned response source should be present"
    );
    assert.strictEqual(
        document.querySelector(`.o_ComposerDropListSuggestion_part1`).textContent,
        "hello",
        "Canned response source should be displayed"
    );
    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion_part2',
        "Canned response substitution should be present"
    );
    assert.strictEqual(
        document.querySelector(`.o_ComposerDropListSuggestion_part2`).textContent,
        "Hello, how are you?",
        "Canned response substitution should be displayed"
    );
});

QUnit.test('canned response suggestion active', async function (assert) {
    assert.expect(2);

    await this.start();
    const cannedResponse = this.env.models['mail.canned_response'].create({
        id: 7,
        source: 'hello',
        substitution: "Hello, how are you?",
    });
    await this.createCannedResponseSuggestion(cannedResponse);

    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion',
        "Canned response suggestion should be displayed"
    );
    assert.hasClass(
        document.querySelector('.o_ComposerDropListSuggestion'),
        'active',
        "should be active initially"
    );
});

});
});
});

});
