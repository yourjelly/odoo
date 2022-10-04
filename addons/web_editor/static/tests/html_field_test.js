/** @odoo-module **/

import { getFixture, patchWithCleanup, clickSave } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { HtmlField } from "@web_editor/js/backend/html_field";

const RED_TEXT = /* html */ `<div class="kek" style="color:red">some text</div>`;

QUnit.module("Fields", ({ beforeEach }) => {
    let serverData;
    let target;
    let currentWysiwyg;
    let currentHtmlField;

    beforeEach(() => {
        serverData = {
            models: {
                partner: {
                    fields: {
                        txt: { string: "txt", type: "html", trim: true },
                    },
                    records: [{ id: 1, txt: RED_TEXT }],
                },
            },
        };
        target = getFixture();

        setupViewRegistries();

        patchWithCleanup(HtmlField.prototype, {
            setup() {
                currentHtmlField = this;
                return this._super.apply(this, arguments);
            },
            startWysiwyg: function (wysiwyg) {
                currentWysiwyg = wysiwyg;

                // To enable collaboration.
                patchWithCleanup(wysiwyg.getSession(), {
                    notification_type: 'email'
                });
                patchWithCleanup(wysiwyg, {
                    // Disable the bus.
                    _setupCollaborationBus: function() {
                        this._collaborationStopBus = () => {};
                    },
                    // Disable all RPC method made with the mutex.
                    _getRpcMutex: function () {
                        const obj = this._super();
                        patchWithCleanup(obj, {
                            exec: () => {}
                        });
                        return obj;
                    },
                    _getIceServers() {
                        return [];
                    },
                    _getCurrentRecord: function () {
                        return {
                            id: serverData.models.partner.records[0].id,
                            txt: serverData.models.partner.records[0].txt,
                        }
                    },
                });

                this._super(wysiwyg);
            }
        });
    });

    QUnit.module("HtmlField");

    QUnit.module("Collaboration");

    QUnit.test("if there is a potential conflict with record in database, show a dialog and reset the editor with the new record", async (assert) => {
        assert.expect(4);

        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: /* xml */ `<form><field name="txt" options="{'collaborative': true}"/></form>`,
        });

        currentWysiwyg._signalOffline();

        const newContent = '<p>b</p>';
        let resetCalled = false;
        let resetContent;
        // Simulate a change in the database.
        patchWithCleanup(currentWysiwyg, {
            _getCurrentRecord() {
                return {
                    id: serverData.models.partner.records[0].id,
                    txt: newContent,
                }
            },
            resetEditor(content) {
                resetCalled = true;
                resetContent = content;
                return this._super.apply(this, arguments);
            }
        });

        await currentWysiwyg._signalOnline();
        // Wait for the dialog to open.
        await new Promise(r => setTimeout(r));

        assert.strictEqual(resetCalled, true);
        assert.strictEqual(resetContent, newContent);
        assert.strictEqual(currentWysiwyg.odooEditor.editable.innerHTML, newContent);
        assert.strictEqual($(target).find('.modal-body .note-editable.odoo-editor-editable').html(), RED_TEXT);
    });
    QUnit.test("if a record did not changed in the database, no conflict should be triggered", async (assert) => {
        assert.expect(2);

        await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: /* xml */ `<form><field name="txt" options="{'collaborative': true}"/></form>`,
        });

        currentWysiwyg._signalOffline();

        let resetCalled = false;
        patchWithCleanup(currentWysiwyg, {
            resetEditor: function (...args) {
                resetCalled = true;
                this._super(...args);
            }
        });
        await currentWysiwyg._signalOnline();

        assert.strictEqual(resetCalled, false);
        assert.strictEqual(currentWysiwyg.odooEditor.editable.innerHTML, RED_TEXT);
    });
    QUnit.only("should not save if the wysiwyg.preSavePromise is not finished", async (assert) => {
        // This case can happen if a user was 1) disconnected, 2) reconnected,
        // 3) the preSavePromise was not resolved because of the rpc sent by
        // _getCurrentRecord did not finish its roundtrip, and 4) an urgent save
        // is triggered.
        assert.expect(2);

        let calledPartnerWrites = [];
        const formView = await makeView({
            type: "form",
            resModel: "partner",
            resId: 1,
            serverData,
            arch: /* xml */ `<form><field name="txt" options="{'collaborative': true}"/></form>`,
            mockRPC: function(route, args) {
                if (route === "/web/dataset/call_kw/partner/write") {
                    calledPartnerWrites.push(args);
                }
            }
        });

        // Do some change in the document that sets it dirty.
        currentWysiwyg.odooEditor.editable.querySelector('.kek').innerText = 'foo';
        currentWysiwyg.odooEditor.historyStep();
        await currentHtmlField.commitChanges();
        // Wait for the currentHtmlField to have it's props updated by
        // currentHtmlField.props.update().
        await new Promise((r) => setTimeout(r));

        currentWysiwyg._signalOffline();

        patchWithCleanup(currentWysiwyg, {
            // Simulate a request that never responds.
            _getCurrentRecord() {
                return new Promise(() => {});
            },
        });

        currentWysiwyg._signalOnline();

        formView.model.root.urgentSave();
        // Wait for the urgent save to make the RPC call.
        await new Promise(r => setTimeout(r));

        assert.strictEqual(calledPartnerWrites.length, 1);
        assert.strictEqual(calledPartnerWrites[0].args[1].txt, undefined);
    });
});
