/** @odoo-module **/

import core from 'web.core';
import Widget from 'web.Widget';
import Dialog from "web.Dialog";
import utils from 'web.utils';
import { ComponentWrapper, WidgetAdapterMixin } from 'web.OwlCompatibility';
import { useService } from "@web/core/utils/hooks";
import { KnowledgeMacro } from './knowledge_macros';
const { Component } = owl;
const _t = core._t;

/**
 * A KnowledgeToolbar is a toolbar that is inserted in a field_html, and that is destined to interact with elements in
 * the OdooEditor editable element. The toolbars are always visible and are absolutely positioned over the element they are
 * corresponding to.
 *
 * This is an abstract class that handles basic behaviors for such a Toolbar, and is destined to be extended for functional
 * purposes
 */
class KnowledgeToolbarComponent extends Component {
    setup() {
        this.uiService = useService('ui');
    }
}
KnowledgeToolbarComponent.template = 'knowledge.toolbar_component';
const KnowledgeToolbar = Widget.extend(WidgetAdapterMixin, {
    /**
     * @override
     * @param {Object} parent
     * @param {Element} anchor element that can be interacted with via the toolbar
     * @param {string} template html template for the toolbar
     */
    init: function (parent, owner, anchor, template, historyMethods) {
        this._super.apply(this, [parent]);
        this.owner = owner;
        this.anchor = anchor;
        this.template = template;
        this.mode = parent.mode;
        this.field = parent.field;
        this.historyMethods = historyMethods;

        // this.anchor.classList.add('oe_unremovable');
        this.anchor.setAttribute('contenteditable', 'false');
    },
    /**
     * @override
     */
    start: function () {
        const prom = this._super.apply(this, arguments);
        this.component = new ComponentWrapper(this, KnowledgeToolbarComponent, {});
        const componentPromise = this.component.mount(this.el);
        return Promise.all([prom, componentPromise]).then(function () {
            this._setupButtons();
        }.bind(this));
    },
    update: function () {
        return this.component.update({});
    },
    /**
     * @private
     */
    _setupButtons: function () {
        const buttons = this.el.querySelectorAll('button');
        buttons.forEach(this._setupButton.bind(this));
    },
    /**
     * @private
     */
    _removeOwner: function () {
        this.owner.classList.remove('oe_unremovable');
        this.owner.remove();
    },
    /**
     * @private
     */
    _removeToolbar: function () {
        this.historyMethods.observerUnactive();
        this.trigger_up('toolbar_removed', {
            anchor: this.anchor,
        });
        this.anchor.knowledgeToolbar = undefined;
        this.component.destroy();
        this.destroy();
        this.historyMethods.observerActive();
    },
    /** Functions to override **/
    /**
     * This function is called for each button of the toolbar. Each button should have a data-call attribute which
     * is used as key for differentiation
     *
     * Common implementation would be a switch case on "button.dataset.call"
     *
     * @param {Element} button
     */
    _setupButton: function (button) {
        button.addEventListener("dblclick", function (ev) {
            ev.stopPropagation();
            ev.preventDefault();
        });
        return;
    },
});

/**
 * Toolbar for the /file command
 */
const FileToolbar = KnowledgeToolbar.extend({
    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this.recordWithChatter = this.call('knowledgeService', 'getAvailableRecordWithChatter');
    },
    _setupButton: function (button) {
        this._super.apply(this, arguments);
        switch (button.dataset.call) {
            case 'attach_to_message':
                button.addEventListener("click", async function(ev) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    const record = this.recordWithChatter;
                    if (record) {
                        const breadcrumbsIndex = record.breadcrumbs.length - 1;
                        const breadcrumbsTitle = record.breadcrumbs[breadcrumbsIndex].title;
                        //CREATE FILELIST FOR FAKE DROP FILE EVENT
                        const fileLink = this.owner.querySelector('.o_knowledge_file_image > a');
                        const url = fileLink.href;
                        const name = fileLink.getAttribute('title');
                        const data = await fetch(url).then(async function (response) {
                            if (response.ok) {
                                return await response.blob();
                            } else {
                                return null;
                            }
                        });
                        if (!data) {
                            return;
                        }
                        const file = new File([data], name, { type: data.type });
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);

                        let macro = new KnowledgeMacro(breadcrumbsIndex, breadcrumbsTitle, button.dataset.call, {
                            dataTransfer: dataTransfer,
                        }, this.component.componentRef.comp.uiService);
                        macro.start();
                    }
                }.bind(this));
                break;
            case 'use_as_attachment':
                button.addEventListener("click", async function(ev) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    const record = this.recordWithChatter;
                    if (record) {
                        const breadcrumbsIndex = record.breadcrumbs.length - 1;
                        const breadcrumbsTitle = record.breadcrumbs[breadcrumbsIndex].title;
                        const fileLink = this.owner.querySelector('.o_knowledge_file_image > a');
                        const url = fileLink.href;
                        const name = fileLink.getAttribute('title');
                        const data = await fetch(url).then(async function (response) {
                            if (response.ok) {
                                return await response.blob();
                            } else {
                                return null;
                            }
                        });
                        if (!data) {
                            // TODO inform user of failure
                            return;
                        }
                        const dataURL = await utils.getDataURLFromFile(data);
                        const attachment = await this._rpc({
                            route: '/web_editor/attachment/add_data',
                            params: {
                                'name': name,
                                'data': dataURL.split(',')[1],
                                'is_image': false,
                                'res_id': this.recordWithChatter.res_id,
                                'res_model': this.recordWithChatter.res_model,
                            }
                        });
                        if (!attachment) {
                            // TODO inform user of failure
                            return;
                        }
                        let macro = new KnowledgeMacro(breadcrumbsIndex, breadcrumbsTitle, button.dataset.call, {},
                            this.component.componentRef.comp.uiService);
                        macro.start();
                    }
                }.bind(this));
                break;
            case 'download':
                const download = async function (ev) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    // Roundabout way to click on the link, to avoid OdooEditor interference with the event
                    const downloadLink = document.createElement('a');
                    const originalLink = this.owner.querySelector('.o_knowledge_file_image > a');
                    const href = originalLink.getAttribute('href');
                    const response = await fetch(href).then((response) => response);
                    if (response.ok) {
                        downloadLink.setAttribute('href', href);
                        downloadLink.setAttribute('download', '');
                        downloadLink.click();
                    } else {
                        Dialog.alert(this,
                            _t("This file is not available at this location anymore."), {
                            title: `${response.status}: ${response.statusText}`,
                        });
                    }
                }.bind(this);
                button.addEventListener("click", download);
                const imageElement = this.owner.querySelector('.o_knowledge_file_image');
                if (!imageElement.__knowledge_download) {
                    imageElement.addEventListener("click", download);
                    imageElement.__knowledge_download = true;
                }
                break;
        }
    },
});

/**
 * Toolbar for the /template command
 */
const TemplateToolbar = KnowledgeToolbar.extend({
    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this.recordWithChatter = this.call('knowledgeService', 'getAvailableRecordWithChatter');
        this.recordWithHtmlField = this.call('knowledgeService', 'getAvailableRecordWithHtmlField');
    },
    /**
     * @override
     */
    _setupButton: function (button) {
        this._super.apply(this, arguments);
        switch (button.dataset.call) {
            case 'send_as_message':
                button.addEventListener("click", function (ev) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    const record = this.recordWithChatter;
                    if (record) {
                        const breadcrumbsIndex = record.breadcrumbs.length - 1;
                        const breadcrumbsTitle = record.breadcrumbs[breadcrumbsIndex].title;
                        const dataTransfer = new DataTransfer();
                        const content = this.owner.querySelector('.o_knowledge_content');
                        dataTransfer.setData('text/html', content.outerHTML);
                        let macro = new KnowledgeMacro(breadcrumbsIndex, breadcrumbsTitle, button.dataset.call, {
                            dataTransfer: dataTransfer,
                        }, this.component.componentRef.comp.uiService);
                        macro.start();
                    }
                }.bind(this));
                break;
            case 'use_as_description':
                button.addEventListener("click", function(ev) {
                    ev.stopPropagation();
                    ev.preventDefault();
                    const record = this.recordWithHtmlField;
                    if (record) {
                        const breadcrumbsIndex = record.breadcrumbs.length - 1;
                        const breadcrumbsTitle = record.breadcrumbs[breadcrumbsIndex].title;
                        const dataTransfer = new DataTransfer();
                        const content = this.owner.querySelector('.o_knowledge_content');
                        dataTransfer.setData('text/html', content.outerHTML);
                        let macro = new KnowledgeMacro(breadcrumbsIndex, breadcrumbsTitle, button.dataset.call, {
                            fieldName: record.fieldNames[0].name,
                            dataTransfer: dataTransfer,
                        }, this.component.componentRef.comp.uiService);
                        macro.start();
                    }
                }.bind(this));
                break;
            case 'copy_to_clipboard':
                button.addEventListener("click", function (ev) {
                    // we don't want to switch to edit mode while clicking on this button
                    ev.stopPropagation();
                    ev.preventDefault();
                });
                const content = this.owner.querySelector('.o_knowledge_content');
                const clipboard = new ClipboardJS(
                    button,
                    {target: () => content}
                );
                clipboard.on('success', (e) => {
                    e.clearSelection();
                    this.displayNotification({
                        type: 'success',
                        message: _t("Template copied to clipboard."),
                    });
                });
                break;
        }
    },
});

export {
    TemplateToolbar,
    FileToolbar,
    KnowledgeToolbar,
};
