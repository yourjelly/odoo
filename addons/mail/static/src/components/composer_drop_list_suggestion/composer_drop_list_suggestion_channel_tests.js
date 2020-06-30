odoo.define('mail/static/src/components/composer_drop_list_suggestion/composer_drop_list_suggestion_channel_tests.js', function (require) {
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
QUnit.module('composer_drop_list_suggestion_channel_tests.js', {
    beforeEach() {
        utilsBeforeEach(this);
        this.createChannelMentionSuggestion = async channel => {
            const ChannelMentionSuggestionComponent = components.ComposerDropListSuggestion;
            ChannelMentionSuggestionComponent.env = this.env;
            this.component = new ChannelMentionSuggestionComponent(
                null,
                {
                    isActive: true,
                    modelName: 'mail.thread',
                    recordLocalId: channel.localId,
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

QUnit.test('channel mention suggestion displayed', async function (assert) {
    assert.expect(1);

    await this.start();
    const channel = this.env.models['mail.thread'].create({
        id: 7,
        name: "General",
    });
    await this.createChannelMentionSuggestion(channel);

    assert.containsOnce(
        document.body,
        `.o_ComposerDropListSuggestion`,
        "Channel mention suggestion should be present"
    );
});

QUnit.test('channel mention suggestion correct data', async function (assert) {
    assert.expect(3);

    await this.start();
    const channel = this.env.models['mail.thread'].create({
        id: 7,
        name: "General",
    });
    await this.createChannelMentionSuggestion(channel);

    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion',
        "Channel mention suggestion should be present"
    );
    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion_part1',
        "Channel name should be present"
    );
    assert.strictEqual(
        document.querySelector(`.o_ComposerDropListSuggestion_part1`).textContent,
        "General",
        "Channel name should be displayed"
    );
});

QUnit.test('partner mention suggestion active', async function (assert) {
    assert.expect(2);

    await this.start();
    const channel = this.env.models['mail.thread'].create({
        id: 7,
        name: "General",
    });
    await this.createChannelMentionSuggestion(channel);

    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion',
        "Channel mention suggestion should be displayed"
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
