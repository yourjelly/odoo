odoo.define('mail/static/src/components/composer_drop_list_suggestion/composer_drop_list_suggestion_command_tests.js', function (require) {
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
QUnit.module('composer_drop_list_suggestion_command_tests.js', {
    beforeEach() {
        utilsBeforeEach(this);
        this.createCommandSuggestion = async command => {
            const CommandSuggestionComponent = components.ComposerDropListSuggestion;
            CommandSuggestionComponent.env = this.env;
            this.component = new CommandSuggestionComponent(
                null,
                {
                    isActive: true,
                    modelName: 'mail.command',
                    recordLocalId: command.localId,
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

QUnit.test('comand suggestion displayed', async function (assert) {
    assert.expect(1);

    await this.start();
    const comand = this.env.models['mail.command'].create({
        name: 'whois',
        help: "Displays who it is",
    });
    await this.createCommandSuggestion(comand);

    assert.containsOnce(
        document.body,
        `.o_ComposerDropListSuggestion`,
        "Command suggestion should be present"
    );
});

QUnit.test('comand suggestion correct data', async function (assert) {
    assert.expect(5);

    await this.start();
    const comand = this.env.models['mail.command'].create({
        name: 'whois',
        help: "Displays who it is",
    });
    await this.createCommandSuggestion(comand);

    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion',
        "Command suggestion should be present"
    );
    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion_part1',
        "Command name should be present"
    );
    assert.strictEqual(
        document.querySelector(`.o_ComposerDropListSuggestion_part1`).textContent,
        "whois",
        "Command name should be displayed"
    );
    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion_part2',
        "Command help should be present"
    );
    assert.strictEqual(
        document.querySelector(`.o_ComposerDropListSuggestion_part2`).textContent,
        "Displays who it is",
        "Command help should be displayed"
    );
});

QUnit.test('comand suggestion active', async function (assert) {
    assert.expect(2);

    await this.start();
    const comand = this.env.models['mail.command'].create({
        name: 'whois',
        help: "Displays who it is",
    });
    await this.createCommandSuggestion(comand);

    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion',
        "Command suggestion should be displayed"
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
