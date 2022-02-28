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
    start: function () {
        return this._super.apply(this, arguments).then(function () {
            this.owner.setAttribute('contenteditable', 'false');
        }.bind(this));
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
                        const content = this.owner.querySelector('.o_knowledge_template_content');
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
                        const content = this.owner.querySelector('.o_knowledge_template_content');
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
                const clipboard = new ClipboardJS(
                    button,
                    {target: () => this.owner}
                );
                clipboard.on('success', (e) => {
                    this.displayNotification({
                        type: 'success',
                        message: _t("Template copied to clipboard."),
                    });
                });
                break;
        }
    },
});

/**
 * This widget is used by a field_html to maintain knowledgeToolbars where they need to be (positioning, creation, deletion)
 */
const ToolbarsManager = Widget.extend({
    custom_events: {
        toolbar_removed: '_onToolbarRemoved',
    },
    toolbar_types: {
        o_knowledge_toolbar_type_template: {
            template: 'knowledge.template_toolbar',
            Toolbar: TemplateToolbar,
        },
        o_knowledge_toolbar_type_file: {
            template: 'knowledge.file_toolbar',
            Toolbar: FileToolbar,
        },
    },
    /**
     * @override
     * @param {Object} parent
     * @param {string} mode 'edit' or 'readonly'
     */
    init: function (parent, mode, historyMethods) {
        this._super.apply(this, arguments);
        this.anchors = new Set();
        this.mode = mode;
        this.historyMethods = historyMethods;
        this.template = 'knowledge.toolbars_manager';
    },
    /**
     * First initialisation of the Manager once it is started
     *
     * @param {Element} element field element for which the toolbars are created
     * @returns {Promise} promise to append the initial batch of Toolbars to this ToolbarManager
     */
    manageToolbars: function (element) {
        this.field = element;
        $(this.field).on('refresh_knowledge_toolbars', this._onUpdateToolbars.bind(this));
        return this.updateToolbars();
    },
    /**
     * If toolbarsData is set, update only those toolbars, if not, recompute every Toolbar of this.field
     *
     * @param {Array} toolbarsData
     * @param {Element} [anchor] the element linked to the toolbar
     * @param {string} [type] html class representing the type of the anchor (i.e.: o_knowledge_template)
     * @returns {Promise} promise to append every Toolbar to this ToolbarManager
     */
    updateToolbars: function (toolbarsData = []) {
        this.historyMethods.observerUnactive();

        if (!toolbarsData.length) {
            const anchors = new Set();
            const types = new Set(Object.getOwnPropertyNames(this.toolbar_types));
            this.field.querySelectorAll('.o_knowledge_toolbars_owner').forEach(function (types, owner) {
                owner.querySelectorAll('.o_knowledge_toolbar_anchor').forEach(function (types, owner, anchor) {
                    const type = Array.from(anchor.classList).find(className => types.has(className));
                    if (type) {
                        toolbarsData.push({
                            owner: owner,
                            anchor: anchor,
                            type: type,
                        });
                        anchors.add(anchor);
                    }
                }.bind(this, types, owner));
            }.bind(this, types));
            const differenceAnchors = new Set([...this.anchors].filter(anchor => !anchors.has(anchor)));
            differenceAnchors.forEach(anchor => {
                if (anchor.knowledgeToolbar) {
                    anchor.knowledgeToolbar._removeToolbar();
                } else {
                    this.anchors.delete(anchor);
                }
            });
        }

        const promises = [];
        toolbarsData.forEach(toolbarData => {
            if (!toolbarData.anchor.knowledgeToolbar) {
                promises.push(this._createToolbar(toolbarData));
            } else if (!this.anchors.has(toolbarData.anchor)) {
                this.anchors.add(toolbarData.anchor);
            }
        });

        return Promise.all(promises).then(() => {
            this.historyMethods.observerActive();
        });
    },
    /**
     * @private
     * @param {Object}
     * @param {Element} [anchor] the element linked to the toolbar
     * @param {string} [type] html class representing the type of the anchor (i.e.: o_knowledge_template)
     * @returns {Promise} promise to append this Toolbar to this ToolbarManager
     */
    _createToolbar: function ({owner, anchor, type}) {
        const {Toolbar, template} = this.toolbar_types[type];
        const toolbar = new Toolbar(this, owner, anchor, template, this.historyMethods);
        anchor.knowledgeToolbar = toolbar;
        this.anchors.add(anchor);
        const firstElementChild = anchor.firstElementChild;
        if (firstElementChild) {
            return toolbar.replace(firstElementChild);
        }
        return toolbar.appendTo(anchor);
    },
    /**
     * @private
     */
    _onToolbarRemoved: function (event) {
        event.stopPropagation();
        this.anchors.delete(event.data.anchor);
    },
    /**
     * @param {Event} e
     * @param {Object} data
     * @param {Array} [toolbarsDatas] Array of objects used for the creation of Toolbars:
     */
    _onUpdateToolbars: function (e, data = {}) {
        if (this.field) {
            this.updateToolbars("toolbarsData" in data ? data.toolbarsData : []);
        }
    },
});

export {
    ToolbarsManager,
    TemplateToolbar,
    FileToolbar,
    KnowledgeToolbar,
};
