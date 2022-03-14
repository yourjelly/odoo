/** @odoo-module */

import { setCursorStart, setCursorEnd } from '@web_editor/../lib/odoo-editor/src/OdooEditor';
import { KnowledgeToolbar } from './knowledge_toolbars';

KnowledgeToolbar.include({
    init: function (parent, owner, anchor, template, historyMethods) {
        this._super.apply(this, arguments);

        if (this.mode === 'edit') {
            // owner operations to be done in the manager. this is unrelated to the toolbar
            this.owner.classList.add('oe_unremovable'); // should be done by the templatemanager not toolbars

            this.owner.querySelectorAll('.o_knowledge_content').forEach(element => { // cursor could be in the content, so we have to set it to true before the parent
                // element.classList.add('oe_unremovable');
                element.setAttribute('contenteditable', 'true');
            });
            this.owner.setAttribute('contenteditable', 'false'); // should be done by the templatemanager, not toolbars
        }
    },
    _setupButton: function (button) {
        this._super.apply(this, arguments);
        switch (button.dataset.call) {
            case 'trash':
                // only available in edit mode. Remove the toolbar and the linked anchor element
                button.addEventListener("click", function (ev) {
                    ev.stopPropagation();
                    ev.preventDefault();

                    const previousElement = this.owner.previousElementSibling;
                    const nextElement = this.owner.nextElementSibling;
                    this._removeOwner();
                    if (nextElement) {
                        setCursorStart(nextElement);
                    } else if (previousElement) {
                        setCursorEnd(previousElement);
                    }
                    this.historyMethods.historyStep();
                }.bind(this));
                break;
        }
    }
});
