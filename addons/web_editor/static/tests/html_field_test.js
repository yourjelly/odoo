/** @odoo-module **/

import { getFixture, patchWithCleanup, clickSave } from "@web/../tests/helpers/utils";
import { makeView, setupViewRegistries } from "@web/../tests/views/helpers";
import { HtmlField } from "@web_editor/js/backend/html_field";

const RED_TEXT = /* html */ `<div class="kek" style="color:red">some text</div>`;

QUnit.module("Fields", ({ beforeEach }) => {
    let serverData;
    let target;
    let currentWysiwyg;

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
});
