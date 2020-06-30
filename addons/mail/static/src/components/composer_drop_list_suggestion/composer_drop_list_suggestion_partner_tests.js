odoo.define('mail/static/src/components/composer_drop_list_suggestion/composer_drop_list_suggestion_partner_tests.js', function (require) {
'use strict';

const components = {
    ComposerDropListSuggestion: require('mail/static/src/components/composer_drop_list_suggestion/composer_drop_list_suggestion.js'),
};
const {
    afterEach: utilsAfterEach,
    beforeEach: beforeEach,
    start,
} = require('mail/static/src/utils/test_utils.js');

QUnit.module('mail', {}, function () {
QUnit.module('components', {}, function () {
QUnit.module('composer_drop_list_suggestion', {}, function () {
QUnit.module('composer_drop_list_suggestion_partner_tests.js', {
    beforeEach() {
        beforeEach(this);

        this.createPartnerMentionSuggestion = async partner => {
            const PartnerMentionSuggestionComponent = components.ComposerDropListSuggestion;
            PartnerMentionSuggestionComponent.env = this.env;
            this.component = new PartnerMentionSuggestionComponent(
                null,
                {
                    isActive: true,
                    modelName: 'mail.partner',
                    recordLocalId: partner.localId,
                });
            await this.component.mount(this.widget.el);
        };

        this.start = async params => {
            const { env, widget } = await start(Object.assign({}, params, {
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

QUnit.test('partner mention suggestion displayed', async function (assert) {
    assert.expect(1);

    await this.start();
    const partner = this.env.models['mail.partner'].create({
        id: 7,
        im_status: 'online',
        name: "Demo User",
    });
    await this.createPartnerMentionSuggestion(partner);

    assert.containsOnce(
        document.body,
        `.o_ComposerDropListSuggestion`,
        "Partner mention suggestion should be present"
    );
});

QUnit.test('partner mention suggestion correct data', async function (assert) {
    assert.expect(6);

    await this.start();
    const partner = this.env.models['mail.partner'].create({
        email: "demo_user@odoo.com",
        id: 7,
        im_status: 'online',
        name: "Demo User",
    });
    await this.createPartnerMentionSuggestion(partner);

    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion',
        "Partner mention suggestion should be present"
    );
    assert.strictEqual(
        document.querySelectorAll(`.o_PartnerImStatusIcon`).length,
        1,
        "Partner's im_status should be displayed"
    );
    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion_part1',
        "Partner's name should be present"
    );
    assert.strictEqual(
        document.querySelector(`.o_ComposerDropListSuggestion_part1`).textContent,
        "Demo User",
        "Partner's name should be displayed"
    );
    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion_part2',
        "Partner's email should be present"
    );
    assert.strictEqual(
        document.querySelector(`.o_ComposerDropListSuggestion_part2`).textContent,
        "(demo_user@odoo.com)",
        "Partner's email should be displayed"
    );
});

QUnit.test('partner mention suggestion active', async function (assert) {
    assert.expect(2);

    await this.start();
    const partner = this.env.models['mail.partner'].create({
        email: "demo_user@odoo.com",
        id: 7,
        im_status: 'online',
        name: "Demo User",
    });
    await this.createPartnerMentionSuggestion(partner);

    assert.containsOnce(
        document.body,
        '.o_ComposerDropListSuggestion',
        "Partner mention suggestion should be displayed"
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
