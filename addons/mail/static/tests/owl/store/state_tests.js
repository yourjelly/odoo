odoo.define('mail.store.StateTests', function (require) {
"use strict";

const {
    afterEach: utilsAfterEach,
    beforeEach: utilsBeforeEach,
    createStore,
    pause,
} = require('mail.owl.test_utils');

QUnit.module('mail.owl', {}, function () {
QUnit.module('store', {}, function () {
QUnit.module('State', {
    beforeEach() {
        utilsBeforeEach(this);
        this.createStore = async params => {
            if (this.widget) {
                this.widget.destroy();
            }
            let { store, widget } = await createStore({
                ...params,
                data: this.data,
            });
            this.store = store;
            this.widget = widget;
        };
    },
    afterEach() {
        utilsAfterEach(this);
        this.store = undefined;
        if (this.widget) {
            this.widget.destroy();
            this.widget = undefined;
        }
    }
});

QUnit.test("current partner", async function (assert) {
    assert.expect(7);

    await this.createStore({
        session: {
            name: "Admin",
            partner_id: 3,
            partner_display_name: "Your Company, Admin",
            uid: 2,
        },
    });

    assert.strictEqual(
        this.store.state.currentPartnerLocalId,
        'res.partner_3');
    const currentPartner = this.store.state.partners[this.store.state.currentPartnerLocalId];
    assert.strictEqual(currentPartner.display_name, "Your Company, Admin");
    assert.strictEqual(currentPartner.displayName, "Admin");
    assert.strictEqual(currentPartner.id, 3);
    assert.strictEqual(currentPartner.localId, 'res.partner_3');
    assert.strictEqual(currentPartner.name, "Admin");
    assert.strictEqual(currentPartner.userId, 2);
});

QUnit.test("inbox & starred mailboxes", async function (assert) {
    assert.expect(12);

    await this.createStore();

    const mailboxInbox = this.store.state.threads['mail.box_inbox'];
    const mailboxStarred = this.store.state.threads['mail.box_starred'];

    assert.ok(mailboxInbox, "should have mailbox inbox");
    assert.strictEqual(mailboxInbox._model, 'mail.box');
    assert.strictEqual(mailboxInbox.counter, 0);
    assert.strictEqual(mailboxInbox.id, 'inbox');
    assert.strictEqual(mailboxInbox.localId, 'mail.box_inbox');
    assert.strictEqual(mailboxInbox.name, "Inbox"); // language-dependent

    assert.ok(mailboxStarred, "should have mailbox starred");
    assert.strictEqual(mailboxStarred._model, 'mail.box');
    assert.strictEqual(mailboxStarred.counter, 0);
    assert.strictEqual(mailboxStarred.id, 'starred');
    assert.strictEqual(mailboxStarred.localId, 'mail.box_starred');
    assert.strictEqual(mailboxStarred.name, "Starred"); // language-dependent
});

QUnit.test("global state after default '/mail/init_messaging' RPC data", async function (assert) {
    assert.expect(1);

    await this.createStore({
        session: {
            partner_id: 3,
        },
    });

    assert.deepEqual(
        this.store.state,
        {
            MESSAGE_FETCH_LIMIT: 30,
            attachmentNextTemporaryId: -1,
            attachments: {},
            cannedResponses: {},
            chatWindowManager: {
                autofocusChatWindowId: undefined,
                autofocusCounter: 0,
                computed: {
                    availableVisibleSlots: 0,
                    hidden: {
                        chatWindowIds: [],
                        offset: 0,
                        showMenu: false,
                    },
                    visible: [],
                },
                chatWindowIds: [],
                notifiedAutofocusCounter: 0,
            },
            commands: {},
            currentPartnerLocalId: 'res.partner_3',
            dialogManager: {
                dialogs: [],
            },
            discuss: {
                domain: [],
                isOpen: false,
                menu_id: false,
                stringifiedDomain: '[]',
                threadLocalId: null,
            },
            global: {
                innerHeight: 1080,
                innerWidth: 1920,
            },
            isMobile: false,
            isMyselfModerator: false,
            mailFailures: {},
            messages: {},
            moderatedChannelIds: [],
            outOfFocusUnreadMessageCounter: 0,
            partners: {
                'res.partner_odoobot': {
                    _model: 'res.partner',
                    displayName: "OdooBot",
                    id: 'odoobot',
                    localId: 'res.partner_odoobot',
                    messageLocalIds: [],
                    name: "OdooBot",
                },
                'res.partner_3': {
                    _model: 'res.partner',
                    display_name: "Your Company, Admin",
                    displayName: "Admin",
                    id: 3,
                    localId: 'res.partner_3',
                    messageLocalIds: [],
                    name: "Admin",
                    userId: 2,
                }
            },
            temporaryAttachmentLocalIds: {},
            threadCaches: {},
            threads: {
                'mail.box_inbox': {
                    _model: 'mail.box',
                    cacheLocalIds: [],
                    counter: 0,
                    direct_partner: undefined,
                    id: 'inbox',
                    is_minimized: undefined,
                    isPinned: true,
                    localId: 'mail.box_inbox',
                    memberLocalIds: [],
                    members: [],
                    name: 'Inbox',
                    typingMemberLocalIds: []
                },
                'mail.box_starred': {
                    _model: 'mail.box',
                    cacheLocalIds: [],
                    counter: 0,
                    direct_partner: undefined,
                    id: 'starred',
                    is_minimized: undefined,
                    isPinned: true,
                    localId: 'mail.box_starred',
                    memberLocalIds: [],
                    members: [],
                    name: 'Starred',
                    typingMemberLocalIds: []
                }
            }
        }
    );
});

});
});
});
