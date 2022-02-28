/** @odoo-module */

import { setCursorStart, setCursorEnd } from '@web_editor/../lib/odoo-editor/src/OdooEditor';
import { KnowledgeToolbar } from './knowledge_toolbars';

KnowledgeToolbar.include({
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
                }.bind(this));
                break;
        }
    }
});
