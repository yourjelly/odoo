/** @odoo-module */

import core from 'web.core';
import Widget from 'web.Widget';
import Dialog from "web.Dialog";
import utils from 'web.utils';
import { KnowledgeMacro } from './knowledge_macros';
const _t = core._t;

/**
 * Toolbar to be injected through @see FieldHtmlInjector to @see OdooEditor
 * blocks which have specific classes calling for such toolbars.
 *
 * A typical usage could be the following:
 * - An @see OdooEditor block like /template has the generic class:
 *   @see o_knowledge_toolbars_owner to signify that some of its children need
 *   to have toolbars injected.
 * - At least one of the children has the generic class:
 *   @see o_knowledge_toolbar_anchor and is completely empty, to signify that
 *   a toolbar need to be inserted as its own child
 * - The same child also as the specific class:
 *   @see o_knowledge_toolbar_type_[toolbarType] which specifies the type of the
 *   toolbar that needs to be injected. @see FieldHtmlInjector has a dictionary
 *   mapping those classes to the correct toolbar class.
 *
 * The @see KnowledgeToolbar is a basic toolbar intended to be overriden for
 * more complex implementations
 */
const KnowledgeToolbar = Widget.extend({
    /**
     * @override
     * @param {Widget} parent
     * @param {Element} owner root node of the @see OdooEditor block
     * @param {Element} anchor sub-child of @see owner container of the toolbar
     * @param {string} template
     * @param {Object} historyMethods @see OdooEditor history methods package
     * @param {Object} uiService
     */
    init: function (parent, owner, anchor, template, historyMethods, uiService) {
        this._super.apply(this, [parent]);
        this.owner = owner;
        this.anchor = anchor;
        this.template = template;
        this.mode = parent.mode;
        this.field = parent.field;
        this.historyMethods = historyMethods;
        this.uiService = uiService;
    },
    /**
     * @override
     */
    start: function () {
        const prom = this._super.apply(this, arguments);
        return prom.then(function () {
            this._setupButtons();
        }.bind(this));
    },
    /**
     * Setup the toolbar buttons
     */
    _setupButtons: function () {
        const buttons = this.el.querySelectorAll('button');
        buttons.forEach(this._setupButton.bind(this));
    },
    /**
     * Used by "Delete" buttons which remove owner from the dom
     */
    _removeOwner: function () {
        this.owner.classList.remove('oe_unremovable');
        this.owner.remove();
    },
    /**
     * Used by @see KnowledgePlugin to remove toolbars when the field_html is
     * saved. Also used by @see FieldHtmlInjector to manage injected toolbars
     */
    _removeToolbar: function () {
        this.historyMethods.observerUnactive();
        this.trigger_up('toolbar_removed', {
            anchor: this.anchor,
        });
        delete this.anchor.knowledgeToolbar;
        this.destroy();
        this.historyMethods.observerActive();
    },
    // FUNCTIONS TO OVERRIDE \\
    /**
     * Called for each button of the toolbar. Each button should have a
     * data-call attribute which is used as a unique key for differentiation.
     * A common implementation would be a switch case on "button.dataset.call".
     * Intercept dblclick events to avoid @see OdooEditor interference
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
     * Recover the eventual related record from @see KnowledgeService
     *
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this.recordWithChatter = this.call('knowledgeService', 'getAvailableRecordWithChatter');
    },
    /**
     * @override
     */
    _setupButton: function (button) {
        this._super.apply(this, arguments);
        switch (button.dataset.call) {
            /**
             * Create a @see KnowledgeMacro to add the file to a new message
             * in the context of the related record.
             */
            case 'attach_to_message':
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
                            return;
                        }
                        const file = new File([data], name, { type: data.type });
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);

                        let macro = new KnowledgeMacro(breadcrumbsIndex, breadcrumbsTitle, button.dataset.call, {
                            dataTransfer: dataTransfer,
                        }, this.uiService);
                        macro.start();
                    }
                }.bind(this));
                break;
            /**
             * Create a @see KnowledgeMacro to add the file as an attachment of
             * the related record.
             */
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
                            return;
                        }
                        let macro = new KnowledgeMacro(breadcrumbsIndex, breadcrumbsTitle, button.dataset.call, {}, this.uiService);
                        macro.start();
                    }
                }.bind(this));
                break;
            /**
             * Add the file download behavior to the button and the image link
             */
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
     * Recover the eventual related records from @see KnowledgeService
     *
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
            /**
             * Create a @see KnowledgeMacro to copy the content of the /template
             * block and paste it as the content of a new message in the context
             * of the related record, in a fullComposer form dialog
             */
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
                        }, this.uiService);
                        macro.start();
                    }
                }.bind(this));
                break;
            /**
             * Create a @see KnowledgeMacro to copy the content of the /template
             * block and paste it as the content (prepend) of the field_html
             * value of the related record
             */
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
                        }, this.uiService);
                        macro.start();
                    }
                }.bind(this));
                break;
            /**
             * Copy the content of the /template block to the clipboard, and
             * prevent @see OdooEditor interference
             */
            case 'copy_to_clipboard':
                button.addEventListener("click", function (ev) {
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
