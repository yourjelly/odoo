/** @odoo-module */
import Widget from 'web.Widget';
import { TemplateToolbar, FileToolbar } from './knowledge_toolbars';

/**
 * This widget is used by a field_html to maintain knowledgeToolbars where they need to be (positioning, creation, deletion)
 */
 const FieldHtmlInjector = Widget.extend({
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
    init: function (parent, mode, field, historyMethods) {
        this._super.apply(this, arguments);
        this.anchors = new Set();
        this.mode = mode;
        this.field = field;
        this.historyMethods = historyMethods;
    },
    start: function () {
        const prom = this._super.apply(this, arguments);
        const toolbarsPromise = this.manageToolbars();
        return Promise.all([prom, toolbarsPromise]);
    },
    /**
     * First initialisation of the Manager once it is started
     *
     * @param {Element} element field element for which the toolbars are created
     * @returns {Promise} promise to append the initial batch of Toolbars to this FieldHtmlInjector
     */
    manageToolbars: function() {
        $(this.field).on('refresh_knowledge_toolbars', this._onUpdateToolbars.bind(this));
        return this.updateToolbars();
    },
    /**
     * If toolbarsData is set, update only those toolbars, if not, recompute every Toolbar of this.field
     *
     * @param {Array} toolbarsData
     * @param {Element} [anchor] the element linked to the toolbar
     * @param {string} [type] html class representing the type of the anchor (i.e.: o_knowledge_template)
     * @returns {Promise} promise to append every Toolbar to this FieldHtmlInjector
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
     * @returns {Promise} promise to append this Toolbar to this FieldHtmlInjector
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
    FieldHtmlInjector,
};
