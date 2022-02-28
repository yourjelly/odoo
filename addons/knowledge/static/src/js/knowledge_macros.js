/** @odoo-module */

import { activateMacro } from "@web/core/macro";

class KnowledgeMacroPageChangeError extends Error {}
export class KnowledgeMacro {
    constructor (breadcrumbsIndex, breadcrumbsTitle, action, data, uiService, interval = 16) {
        this.breadcrumbsIndex = breadcrumbsIndex;
        this.breadcrumbsTitle = breadcrumbsTitle;
        this.breadcrumbsSelector = `[role="navigation"] > .breadcrumb-item:contains(${breadcrumbsTitle})`;
        this.interval = interval;
        this.data = data;
        this.action = action;
        this.uiService = uiService;
        this.blockUI = { action: function () {
            if (!this.uiService.isBlocked) {
                this.uiService.block();
            }
        }.bind(this) };
        this.unblockUI = { action: function () {
            if (this.uiService.isBlocked) {
                this.uiService.unblock();
            }
        }.bind(this) };
    }
    start() {
        const macroAction = this._macroActions(this.action);
        if (!macroAction) {
            return;
        }
        const startMacro = {
            name: "restore_record",
            interval: this.interval,
            onError: this.onError.bind(this),
            steps: [
                this.blockUI, {
                trigger: function () {
                    const $breadcrumbs = $(`.breadcrumb-item:not(.active)`);
                    if ($breadcrumbs.length > this.breadcrumbsIndex) {
                        const breadcrumb = $breadcrumbs[this.breadcrumbsIndex];
                        if (breadcrumb.textContent.includes(this.breadcrumbsTitle)) {
                            return this.getElement(breadcrumb.querySelector('a'));
                        }
                    }
                    return null;
                }.bind(this),
                action: 'click',
            }, {
                trigger: this.getElement.bind(this, `${this.breadcrumbsSelector}.active`),
                action: activateMacro.bind(this, macroAction),
            }],
        };
        activateMacro(startMacro);
    }
    onError(error, step, index) {
        this.unblockUI.action();
        if (error instanceof KnowledgeMacroPageChangeError) {
            console.warn(error.message);
        } else {
            console.error(error);
        }
    }
    getElement(selector, reverse=false) {
        const $sel = $(selector);
        for (let i = 0; i < $sel.length; i++) {
            i = reverse ? $sel.length - 1 - i : i;
            if ($sel.eq(i).is(':visible:hasVisibility')) {
                return $sel[i];
            }
        }
        return null;
    }
    validatePage() {
        if (!this.getElement(`${this.breadcrumbsSelector}.active`)) {
            throw new KnowledgeMacroPageChangeError(`Macro: ${this.action} was interrupted because the page changed`);
        }
    }
    _macroActions(action) {
        switch (action) {
            case "use_as_description": return {
                name: action,
                interval: this.interval,
                onError: this.onError.bind(this),
                steps: [{
                    trigger: function () {
                        this.validatePage();
                        const selector = `.oe_form_field_html[name="${this.data.fieldName}"]`;
                        const el = this.getElement(selector);
                        if (el) {
                            return el;
                        }
                        // Handles the case where the field is hidden in a tab of the form view notebook
                        const $sel = $(selector);
                        for (let i = 0; i < $sel.length; i++) {
                            const pane = $sel[i].closest('.tab-pane:not(.active)');
                            if (pane) {
                                const paneSwitch = this.getElement(`[data-toggle="tab"][href*="${pane.id}"]`);
                                if (paneSwitch) {
                                    paneSwitch.click();
                                    break;
                                }
                            }
                        }
                        return null;
                    }.bind(this),
                    action: 'click',
                }, {
                    trigger: function () {
                        this.validatePage();
                        return this.getElement(`.oe_form_field_html[name="${this.data.fieldName}"] > .odoo-editor-editable`);
                    }.bind(this),
                    action: this._pasteTemplate.bind(this),
                }, this.unblockUI],
            };
            case "send_as_message": return {
                name: action,
                interval: this.interval,
                onError: this.onError.bind(this),
                steps: [{
                    trigger: function() {
                        this.validatePage();
                        return this.getElement('.o_ChatterTopbar_buttonSendMessage');
                    }.bind(this),
                    action: (el) => {
                        if (!el.classList.contains('o-active')) {
                            el.click();
                        }
                    },
                }, {
                    trigger: function() {
                        this.validatePage();
                        return this.getElement('.o_Composer_buttonFullComposer');
                    }.bind(this),
                    action: 'click',
                }, {
                    trigger: function () {
                        this.validatePage();
                        const dialog = this.getElement('.o_dialog_container.modal-open');
                        if (dialog) {
                            return this.getElement(dialog.querySelector('.oe_form_field_html[name="body"] > .odoo-editor-editable'));
                        } else {
                            return null;
                        }
                    }.bind(this),
                    action: this._pasteTemplate.bind(this),
                }, this.unblockUI],
            };
            case "attach_to_message": return {
                name: action,
                interval: this.interval,
                onError: this.onError.bind(this),
                steps: [{
                    trigger: function() {
                        this.validatePage();
                        return this.getElement('.o_ChatterTopbar_buttonSendMessage');
                    }.bind(this),
                    action: (el) => {
                        el.scrollIntoView();
                        if (!el.classList.contains('o-active')) {
                            el.click();
                        }
                    },
                }, {
                    trigger: function() {
                        this.validatePage();
                        return this.getElement('.o_Composer_buttonAttachment');
                    }.bind(this),
                    action: this._dragAndDrop.bind(this, 'dragenter'),
                }, {
                    trigger: function () {
                        this.validatePage();
                        return this.getElement('.o_Composer_dropZone');
                    }.bind(this),
                    action: this._dragAndDrop.bind(this, 'drop'),
                }, this.unblockUI],
            };
            case "use_as_attachment": return {
                name: action,
                interval: this.interval,
                onError: this.onError.bind(this),
                steps: [{
                    trigger: function() {
                        this.validatePage();
                        return this.getElement('.o_ChatterTopbar_buttonAttachments');
                    }.bind(this),
                    action: function(el) {
                        if (!this.getElement('.o_AttachmentBox_content')) {
                            el.click();
                        }
                    }.bind(this),
                }, {
                    trigger: function() {
                        this.validatePage();
                        return this.getElement('.o_AttachmentBox_content');
                    }.bind(this),
                    action: (el) => el.scrollIntoView(),
                }, this.unblockUI],
            };
        }
    }
    _dragAndDrop(type, el) {
        const fakeDragAndDrop = new Event(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
        });
        fakeDragAndDrop.dataTransfer = this.data.dataTransfer;
        el.dispatchEvent(fakeDragAndDrop);
    }
    _pasteTemplate(el) {
        const fakePaste = new Event('paste', {
            bubbles: true,
            cancelable: true,
            composed: true,
        });
        fakePaste.clipboardData = this.data.dataTransfer;

        const sel = document.getSelection();
        sel.removeAllRanges();
        const range = document.createRange();
        const firstChild = el.firstChild;
        if (!firstChild) {
            range.setStart(el, 0);
            range.setEnd(el, 0);
        } else {
            range.setStartBefore(firstChild);
            range.setEndBefore(firstChild);
        }
        sel.addRange(range);
        el.dispatchEvent(fakePaste);
    }
}
