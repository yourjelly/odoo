/** @odoo-module */

import { setCursorStart, setCursorEnd } from '@web_editor/../lib/odoo-editor/src/OdooEditor';
import { KnowledgeToolbar } from './knowledge_toolbars';

/**
 * @see KnowledgeToolbar
 * This override is loaded as an asset of web_editor to access the cursor
 * positioning utilities
 */
KnowledgeToolbar.include({
    /**
     * set the toolbar anchor as non-editable
     *
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        if (this.mode === 'edit') {
            this.historyMethods.observerUnactive('knowledge_toolbar_uneditable');
            this.anchor.setAttribute('contenteditable', 'false');
            this.historyMethods.observerActive('knowledge_toolbar_uneditable');
        }
    },
    /**
     * Create a <p><br></p> element, in case the toolbar owner is the last
     * element of the field_html when it is removed
     *
     * @param {Element} parent
     * @returns {Element}
     */
    _replaceByPBR: function (parent) {
        const document = parent.ownerDocument;
        const pElement = document.createElement('P');
        const brElement = document.createElement('BR');
        pElement.append(brElement);
        parent.append(pElement);
        return pElement;
    },
    /**
     * @override
     * @param {Element} button
     */
    _setupButton: function (button) {
        this._super.apply(this, arguments);
        switch (button.dataset.call) {
            /**
             * Handle the trash button of a toolbar_owner to remove the block
             */
            case 'trash':
                button.addEventListener("click", function (ev) {
                    ev.stopPropagation();
                    ev.preventDefault();

                    const previousElement = this.owner.previousElementSibling;
                    const nextElement = this.owner.nextElementSibling;
                    const parent = this.owner.parentElement;
                    this._removeOwner();
                    if (nextElement) {
                        setCursorStart(nextElement);
                    } else if (previousElement) {
                        setCursorEnd(previousElement);
                    } else {
                        setCursorStart(this._replaceByPBR(parent));
                    }
                    this.historyMethods.historyStep();
                }.bind(this));
                break;
        }
    }
});
