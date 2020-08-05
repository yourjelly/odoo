odoo.define('web_editor.wysiwyg', function (require) {
'use strict';

var Dialog = require('web.Dialog');
var Widget = require('web.Widget');
var JWEditorLib = require('web_editor.jabberwock');
var SnippetsMenu = require('web_editor.snippet.editor').SnippetsMenu;
var weWidgets = require('wysiwyg.widgets');
var ColorPaletteWidget = require('web_editor.ColorPalette').ColorPaletteWidget;
var AttributeTranslateDialog = require('web_editor.wysiwyg.translate_attributes');
var config = require('web.config');

var core = require('web.core');
var _t = core._t;

var Wysiwyg = Widget.extend({
    defaultOptions: {
        'recordInfo': {
            'context': {},
        },
    },

    /**
     * @options {Object} options
     * @options {Object} options.recordInfo
     * @options {Object} options.recordInfo.context
     * @options {String} [options.recordInfo.context]
     * @options {integer} [options.recordInfo.res_id]
     * @options {String} [options.recordInfo.data_res_model]
     * @options {integer} [options.recordInfo.data_res_id]
     *   @see _onGetRecordInfo
     *   @see _getAttachmentsDomain in /wysiwyg/widgets/media.js
     * @options {Object} options.attachments
     *   @see _onGetRecordInfo
     *   @see _getAttachmentsDomain in /wysiwyg/widgets/media.js (for attachmentIDs)
     * @options {function} options.generateOptions
     *   called with the summernote configuration object used before sending to summernote
     *   @see _editorOptions
     **/
    init: function (parent, options) {
        this._super.apply(this, arguments);
        this.value = options.value || '';
        this.options = options;
        this.colorPickers = [];
        this.JWEditorLib = JWEditorLib;
        if (this.options.enableTranslation) {
            this.options.snippets = null;
            this.options.toolbarLayout = [];
            this.options.customCommands = {
                saveOdoo: {handler: this._onSaveTranslation.bind(this)}
            };
            this.options.mode = {
                id: 'translate',
                rules: [
                    {
                        selector: [],
                        properties: {
                            editable: {
                                value: false,
                                cascading: true,
                            },
                        },
                    },
                    {
                        selector: [this.JWEditorLib.ContainerNode],
                        properties: {
                            breakable: { value: false },
                        },
                    },
                    {
                        selector: [node => !!node.modifiers.find(this.JWEditorLib.OdooTranslationFormat)],
                        properties: {
                            editable: {
                                value: true,
                                cascading: true,
                            },
                        },
                    },
                    {
                        selector: [node => {
                            const attributes = node.modifiers.find(this.JWEditorLib.Attributes);
                            return attributes && attributes.classList.has('o_not_editable');
                        }, () => true],
                        properties: {
                            editable: {
                                value: false,
                                cascading: true,
                            },
                        },
                    },
                ],
            };
        } else if (this.options.enableWebsite) {
            this.options.plugins = [[this.JWEditorLib.OdooField]];
            this.options.mode = {
                id: 'edit',
                rules: [
                    {
                        selector: [
                            (node) => {
                                const attributes = node.modifiers.find(this.JWEditorLib.Attributes);
                                const isWrapper = attributes && attributes.get('id') === 'wrap' ;
                                return isWrapper;
                            },
                        ],
                        properties: {
                            breakable: { value: false },
                            allowEmpty: { value: true },
                        },
                    },
                    {
                        selector: [this.JWEditorLib.DividerNode],
                        properties: {
                            breakable: { value: false },
                            allowEmpty: { value: false },
                        },
                    },
                    {
                        selector: [
                            (node) => {
                                const attributes = node.modifiers.find(this.JWEditorLib.Attributes);

                                const isCountdown = attributes && attributes.classList.has('s_countdown');
                                const isNewsletterPopup = attributes && attributes.classList.has('o_newsletter_popup');
                                const isPopup = attributes && attributes.classList.has('s_popup');

                                return isCountdown || isPopup || isNewsletterPopup;
                            },
                            this.JWEditorLib.ContainerNode],
                        properties: {
                            allowEmpty: { value: true },
                        },
                    },
                ],
            };
        }
    },
    /**
     * Load assets and color picker template then call summernote API
     * and replace $el by the summernote editable node.
     *
     * @override
     **/
    willStart: async function () {
        this.$target = this.$el;
        return this._super();
    },
    /**
     *
     * @override
     */
    start: async function () {
        const self = this;
        const _super = this._super;
        const elementToParse = document.createElement('div');
        const wrapperClass = this.options.wrapperClass || 'd-flex o_editor_center';
        elementToParse.setAttribute('class', wrapperClass);
        elementToParse.innerHTML = this.value;
        elementToParse.style.cssText = 'width: 100%;';

        if (this.options.enableWebsite) {
            $(document.body).addClass('o_connected_user editor_enable');
        }

        const $mainSidebar = $('<div class="o_main_sidebar">');
        const $snippetManipulators = $('<div id="oe_manipulators" />');

        this.editor = new JWEditorLib.OdooWebsiteEditor({
            snippetMenuElement: $mainSidebar[0],
            snippetManipulators: $snippetManipulators[0],
            customCommands: Object.assign({
                openMedia: {handler: this.openMediaDialog.bind(this)},
                openTextColorPicker: {handler: this.toggleTextColorPicker.bind(this)},
                openBackgroundColorPicker: {handler: this.toggleBackgroundColorPicker.bind(this)},
                openLinkDialog: {handler: this.openLinkDialog.bind(this)},
                discardOdoo: {handler: this.discardEditions.bind(this)},
                saveOdoo: {handler: this.saveToServer.bind(this)},
                cropImage: {handler: this.cropImage.bind(this)},
                transformImage: {handler: this.transformImage.bind(this)},
            }, this.options.customCommands),
            source: elementToParse,
            location: this.options.location || [this.el, 'replace'],
            toolbarLayout: this.options.toolbarLayout,
            saveButton: this.options.saveButton,
            discardButton: this.options.discardButton,
            template: this.options.template,
            mode: this.options.mode,
        });

        // if (config.isDebug('assets')) {
        //     this.editor.load(JWEditorLib.DevTools);
        // }
        await this.editor.start();
        this._bindAfterStart();

        const $wrapwrap = $('#wrapwrap');
        $wrapwrap.removeClass('o_editable'); // clean the dom before edition
        this._getEditable($wrapwrap).addClass('o_editable');

        $wrapwrap.data('wysiwyg', this);

        this.$toolbar = $('jw-toolbar').detach();

        this.editorHelpers = this.editor.plugins.get(JWEditorLib.DomHelpers);
        const domLayout = this.editor.plugins.get(JWEditorLib.Layout).engines.dom;
        this.vEditable = domLayout.components.editable[0];
        this.editorEditable = this.editorHelpers.getDomNodes(this.vEditable)[0];

        // add class when page content is empty to show the "DRAG BUILDING BLOCKS HERE" block
        const emptyClass = "oe_blank_wrap";
        const targetNode = this.editorEditable.querySelector("#wrap");
        if (this.options.enableWebsite && targetNode) {
            let mutationCallback = function () {
                if (targetNode.textContent.trim() === '' && !targetNode.querySelector('section, div')) {
                    targetNode.setAttribute('data-editor-message', _t('DRAG BUILDING BLOCKS HERE'));
                    targetNode.classList.add(emptyClass);
                } else {
                    targetNode.classList.remove(emptyClass);
                }
            };
            const observer = new MutationObserver(mutationCallback);
            observer.observe(targetNode, {childList: true});
            // force check at editor startup
            mutationCallback();
        }

        if (this.options.enableTranslation) {
            this._setupTranslation();
        }

        if (this.options.snippets) {
            document.body.classList.add('editor_has_snippets');
            this.$webEditorToolbar = $('<div id="web_editor-toolbars">');

            var $toolbarHandler = $('#web_editor-top-edit');
            $toolbarHandler.append(this.$webEditorToolbar);

            this.snippetsMenu = new SnippetsMenu(this, Object.assign({
                $el: $(this.editorEditable),
                selectorEditableArea: '.o_editable',
                $snippetEditorArea: $snippetManipulators,
                wysiwyg: this,
                JWEditorLib: JWEditorLib,
            }, this.options));
            await this.snippetsMenu.appendTo($mainSidebar);

            this.snippetsMenu.$editor = $('#wrapwrap');

            this.$el.on('content_changed', function (e) {
                self.trigger_up('wysiwyg_change');
            });
        } else {
            return _super.apply(this, arguments);
        }
    },

    openLinkDialog() {
        return new Promise((resolve) => {
            const range = this.editor.selection.range;
            const targettedLeaves = range.targetedNodes(node => !node.hasChildren());
            const text = targettedLeaves.map(x => x.textContent).join('');
            const inline = this.editor.plugins.get(JWEditorLib.Inline);
            const modifiers = inline.getCurrentModifiers(range);
            const linkFormat = modifiers.find(JWEditorLib.LinkFormat);
            const attributes = modifiers.find(JWEditorLib.Attributes);
            const linkFormatAttributes = linkFormat && linkFormat.modifiers.find(JWEditorLib.Attributes);
            const linkInfo = {
                text: text,
                url: linkFormat && linkFormat.url || '',
                class: attributes && attributes.get('class') || '',
                target: linkFormatAttributes && linkFormatAttributes.get('target'),
            };
            var linkDialog = new weWidgets.LinkDialog(this,
                {
                    props: {
                        text: linkInfo.text,
                        url: linkInfo.url,
                        class: linkInfo.class,
                        target: linkInfo.target,
                    }
                },
            );
            linkDialog.open();
            linkDialog.on('save', this, async (params)=> {
                    await this.editor.execCommand(async (context) =>{
                        const linkParams = {
                            url: params.url,
                            label: params.text,
                            target: params.isNewWindow ? '_blank' : '',
                        };
                        await context.execCommand('link', linkParams);
                        const nodes = this.editor.selection.range.targetedNodes(JWEditorLib.InlineNode);
                        const links = nodes.map(node => node.modifiers.find(JWEditorLib.LinkFormat)).filter(f => f);
                        for (const link of links) {
                            link.modifiers.get(JWEditorLib.Attributes).set('class', params.classes);
                        }
                    });
                resolve();
            });
            linkDialog.on('cancel', this, resolve);
        });
    },
    openMediaDialog() {
        return new Promise((resolve)=>{
            var mediaDialog = new weWidgets.MediaDialog(this,
                {},
            );
            mediaDialog.open();
            mediaDialog.on('save', this, async (element) => {
                await this.editorHelpers.insertHtml(this.editor, element.outerHTML);
                resolve();
            });
            mediaDialog.on('cancel', this, resolve);
        });
    },
    _setColor(colorpicker, setCommandId, unsetCommandId, color, $dropDownToToggle = undefined) {
        if(color === "") {
            this.editor.execCommand(unsetCommandId);
        } else {
            if (colorpicker.colorNames.indexOf(color) !== -1) {
                // todo : find a better way to detect and send css variable
                color = "var(--" + color + ")";
            }
            this.editor.execCommand(setCommandId, {color: color});
        }
        if($dropDownToToggle !== undefined) {
            $dropDownToToggle.find(".dropdown-toggle").dropdown("toggle");
        }
    },
    async initColorPicker($dropdownNode, setCommandId, unsetCommandId) {
        if (!$dropdownNode.hasClass("colorpicker-initalized")) {
            $dropdownNode.addClass("colorpicker-initalized");
            // Init the colorPalete for this color picker Dropdown.
            const colorpicker = new ColorPaletteWidget(this, {});

            // Prevent the dropdown to be closed when click inside it
            $dropdownNode.on('click', (e)=> {
                e.stopImmediatePropagation();
                e.preventDefault();
            })
            $dropdownNode.find('.dropdown-menu').empty();
            await colorpicker.appendTo($dropdownNode.find('.dropdown-menu'));
            // Events listeners to trigger color changes
            colorpicker.on('custom_color_picked', this, (e) => {
                this._setColor(colorpicker, setCommandId, unsetCommandId, e.data.color);
            });
            colorpicker.on('color_picked', this, (e) => {
                this._setColor(colorpicker, setCommandId, unsetCommandId, e.data.color, $dropdownNode);
            });
        }
    },
    async toggleTextColorPicker() {
        // event.target equal the current toggle button clicked.
        const $textColorDropdown = $(event.target).parent();
        await this.initColorPicker(
            $textColorDropdown,
            "colorText",
            "uncolorText");

        $textColorDropdown.find(".dropdown-toggle").dropdown("toggle");
    },
    async toggleBackgroundColorPicker() {
        // event.target equal the current toggle button clicked.
        const $backgroundColorDropdown = $(event.target).parent();
        await this.initColorPicker(
            $backgroundColorDropdown,
            "colorBackground",
            "uncolorBackground");

        $backgroundColorDropdown.find(".dropdown-toggle").dropdown("toggle");
    },

    /**
     * @override
     */
    destroy: function () {
        this.editor.stop();
        this._super();
    },
    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------
    /**
     * Return the editable area.
     *
     * @returns {jQuery}
     */
    getEditable: function () {
        return this.$editor;
    },
    /**
     * Return true if the content has changed.
     *
     * @returns {Boolean}
     */
    isDirty: async function () {
        // todo: use jweditor memory to know if it's dirty.
        return true;
    },
    /**
     * Set the focus on the element.
     */
    focus: function () {
        // todo: handle tab that need to go to next field if the editor does not
        //       catch it.
        this.$el.find('[contenteditable="true"]').focus();
    },
    /**
     * Get the value of the editable element.
     *
     * @param {object} [options]
     * @param {jQueryElement} [options.$layout]
     * @returns {String}
     */
    getValue: async function () {
        return (await this.editor.getValue()).innerHTML;
    },
    /**
     * @param {String} value
     * @param {Object} options
     * @param {Boolean} [options.notifyChange]
     * @returns {String}
     */
    setValue: function (value, options) {
        this._value = value;
    },
    saveToServer: async function (reload = true) {
        const defs = [];
        this.trigger_up('edition_will_stopped');
        this.trigger_up('ready_to_save', {defs: defs});
        await Promise.all(defs);

        if (this.snippetsMenu) {
            await this.snippetsMenu.cleanForSave();
        }

        await this._saveContent();

        this.trigger_up('edition_was_stopped');
        if (reload) {
            window.location.reload();
        }
    },
    discardEditions: async function () {
        var self = this;
        return new Promise(function (resolve, reject) {
            var confirm = Dialog.confirm(this, _t("If you discard the current edits, all unsaved changes will be lost. You can cancel to return to edit mode."), {
                confirm_callback: resolve,
            });
            confirm.on('closed', self, reject);
        }).then(function () {
            window.onbeforeunload = null;
            window.location.reload();
        });
    },
    cropImage: async function (params) {
        const imageNodes = params.context.range.targetedNodes(JWEditorLib.ImageNode);
        const imageNode = imageNodes.length === 1 && imageNodes[0];
        if (imageNode) {
            const domEngine = this.editor.plugins.get(JWEditorLib.Layout).engines.dom;
            const $node = $(domEngine.getDomNodes(imageNode)[0]);
            $node.off('image_cropped');
            $node.on('image_cropped', () => this._updateAttributes($node[0]));
            new weWidgets.ImageCropWidget(this, $node[0]).appendTo($('#wrap'));
        }
    },
    _updateAttributes(node) {
        const attributes = {}
        for (const attr of node.attributes){
            attributes[attr.name] = attr.value;
        }
        this.editorHelpers.updateAttributes(this.editor, node, attributes);
    },
    transformImage: async function (params) {
        const imageNodes = params.context.range.targetedNodes(JWEditorLib.ImageNode);
        const imageNode = imageNodes.length === 1 && imageNodes[0];
        if (imageNode) {
            const domEngine = this.editor.plugins.get(JWEditorLib.Layout).engines.dom;
            const $node = $(domEngine.getDomNodes(imageNode)[0]);
            this._transform($node);
        }
    },
    _transform($image) {
        if ($image.data('transfo-destroy')) {
            $image.removeData('transfo-destroy');
            return;
        }

        $image.transfo();

        const mouseup = (event) => {
            $('.note-popover button[data-event="transform"]').toggleClass('active', $image.is('[style*="transform"]'));
        };
        $(document).on('mouseup', mouseup);

        const mousedown = (event) => {
            if (!$(event.target).closest('.transfo-container').length) {
                $image.transfo('destroy');
                $(document).off('mousedown', mousedown).off('mouseup', mouseup);
            }
            if ($(event.target).closest('.note-popover').length) {
                $image.data('transfo-destroy', true).attr('style', ($image.attr('style') || '').replace(/[^;]*transform[\w:]*;?/g, ''));
            }
            this._updateAttributes($image[0])
        };
        $(document).on('mousedown', mousedown);
    },

    getFormatInfo: function() {
        return this.editor.plugins.get(JWEditorLib.Odoo).formatInfo;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Save after any cleaning has been done and before reloading
     * the page.
     */
    async _saveContent() {
        await this._saveModifiedImages();
        await this.editor.execCommand(async (context)=> {
            await this._saveViewBlocks();
            await this._saveCoverPropertiesBlocks(context);
            await this._saveMegaMenuClasses();
        });
    },
    /**
     * Gets jQuery cloned element with internal text nodes escaped for XML
     * storage.
     *
     * @private
     * @param {jQuery} $el
     * @return {jQuery}
     */
    _getEscapedElement: function ($el) {
        var escaped_el = $el.clone();
        var to_escape = escaped_el.find('*').addBack();
        to_escape = to_escape.not(to_escape.filter('object,iframe,script,style,[data-oe-model][data-oe-model!="ir.ui.view"]').find('*').addBack());
        to_escape.contents().each(function () {
            if (this.nodeType === 3) {
                this.nodeValue = $('<div />').text(this.nodeValue).html();
            }
        });
        return escaped_el;
    },
    /**
     * Returns a translation object.
     *
     * @private
     * @param {Node} node
     * @returns {Object}
     */
    _getTranslationObject: function (node) {
        var $node = $(node);
        var id = +$node.data('oe-translation-id');
        if (!id) {
            id = $node.data('oe-model') + ',' + $node.data('oe-id') + ',' + $node.data('oe-field');
        }
        var translation = _.find(this.translations, function (translation) {
            return translation.id === id;
        });
        if (!translation) {
            this.translations.push(translation = {'id': id});
        }
        return translation;
    },
    /**
     * @private
     */
    _markTranslatableNodes: function () {
        const self = this;
        const $editable = $(this.editorEditable);
        $editable.prependEvent('click.translator', function (ev) {
            if (ev.ctrlKey || !$(ev.target).is(':o_editable')) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
        });

        // attributes

        this.$nodesToTranslateAttributes.each(function () {
            var $node = $(this);
            var translation = $node.data('translation');
            _.each(translation, function (node) {
                if (node) {
                    var translation = self._getTranslationObject(node);
                    translation.value = (translation.value ? translation.value : $node.html()).replace(/[ \t\n\r]+/, ' ');
                    $node.attr('data-oe-translation-state', (translation.state || 'to_translate'));
                }
            });
        });

        this.$nodesToTranslateAttributes.prependEvent('mousedown.translator click.translator mouseup.translator', function (ev) {
            if (ev.ctrlKey) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.type !== 'mousedown') {
                return;
            }

            new AttributeTranslateDialog(self, {
                editor: self.editor,
                editorHelpers: self.editorHelpers,
            }, ev.target).open();
        });
    },
    /**
     * Return a promise resulting from a rpc to 'ir.ui.view' to save the given
     * view to the given viewId.
     *
     * @param {JQuery} $elem
     * @param {number} viewId
     * @param {string} [xpath]
     */
    _saveViewTo($elem, viewId, xpath = null) {
        const $escapedElement = this._getEscapedElement($elem);
        return this._rpc({
            model: 'ir.ui.view',
            method: 'save',
            args: [
                viewId,
                $escapedElement.prop('outerHTML'),
                xpath,
            ],
            context: this.options.recordInfo.context,
        });
    },
    /**
     * Return a promise resulting from a rpc to 'ir.translation' to save the
     * given view to the given translationId.
     *
     * @param {JQuery} $elem
     * @param {number} translationId
     * @param {string} [xpath]
     */
    _saveTranslationTo($elem, translationId) {
        const $escapedElement = this._getEscapedElement($elem);
        return this._rpc({
            model: 'ir.translation',
            method: 'save_html',
            args: [
                [translationId],
                $escapedElement.html() || $escapedElement.text() || '',
            ],
            context: this.options.recordInfo.context,
        });
    },
    /**
     * Save all "view" blocks.
     *
     * @private
     */
    _saveViewBlocks: async function () {
        const promises = [];
        const nodes = this.vEditable.descendants(node => {
            return (
                node instanceof JWEditorLib.OdooStructureNode ||
                node instanceof JWEditorLib.OdooFieldNode
            );
        });
        for (const node of nodes) {
            const renderer = this.editor.plugins.get(JWEditorLib.Renderer);
            const renderedNode = (await renderer.render('dom/html', node))[0];
            $(renderedNode).find('.o_snippet_editor_updated').addBack().removeClass('o_snippet_editor_updated');
            //if ($(renderedNode).find('.card-header')) {
               //throw new Error('do not save') ;
            //}
            promises.push(this._saveViewTo($(renderedNode), +renderedNode.dataset.oeId, node.xpath));
        }
        return Promise.all(promises);
    },

    /**
     * Save all "cover properties" blocks.
     *
     * @private
     */
    _saveCoverPropertiesBlocks: async function (context) {
        let rpcResult;
        await context.execCommand(async () => {
            const covers = this.vEditable.descendants(node => {
                const attributes = node.modifiers.find(JWEditorLib.Attributes);

                if (attributes && attributes.length && typeof attributes.get('class') === 'string') {
                    return attributes.classList.has('o_record_cover_container');
                }
            });
            const el = covers && covers[0] && this.editorHelpers.getDomNodes(covers[0])[0];
            if (!el) {
                console.warn('No cover found.');
                return;
            }

            var resModel = el.dataset.resModel;
            var resID = parseInt(el.dataset.resId);
            if (!resModel || !resID) {
                throw new Error('There should be a model and id associated to the cover.');
            }

            this.__savedCovers = this.__savedCovers || {};
            this.__savedCovers[resModel] = this.__savedCovers[resModel] || [];

            if (this.__savedCovers[resModel].includes(resID)) {
                return;
            }
            this.__savedCovers[resModel].push(resID);

            var cssBgImage = $(el.querySelector('.o_record_cover_image')).css('background-image');
            var coverProps = {
                'background-image': cssBgImage.replace(/"/g, '').replace(window.location.protocol + "//" + window.location.host, ''),
                'background_color_class': el.dataset.bgColorClass,
                'background_color_style': el.dataset.bgColorStyle,
                'opacity': el.dataset.filterValue,
                'resize_class': el.dataset.coverClass,
                'text_align_class': el.dataset.textAlignClass,
            };

            rpcResult = this._rpc({
                model: resModel,
                method: 'write',
                args: [
                    resID,
                    {'cover_properties': JSON.stringify(coverProps)}
                ],
            });
        });
        return rpcResult;
    },
    /**
     * Save all "mega menu" classes.
     *
     * @private
     */
    _saveMegaMenuClasses: async function () {
        const structureNodes = this.vEditable.descendants((node) => {
            return node.modifiers.get(JWEditorLib.Attributes).get('data-oe-field') === 'mega_menu_content';
        });
        const promises = [];
        for (const node of structureNodes) {
            // On top of saving the mega menu content like any other field
            // content, we must save the custom classes that were set on the
            // menu itself.
            // FIXME: normally removing the 'show' class should not be necessary here
            // TODO: check that editor classes are removed here as well
            let promises = [];
            const items = node.modifiers.get(JWEditorLib.Attributes).classList.items();
            var classes = _.without(items, 'dropdown-menu', 'o_mega_menu', 'show');

            const itemId = node.modifiers.get(JWEditorLib.Attributes).get('data-oe-id');

            promises.push(this._rpc({
                model: 'website.menu',
                method: 'write',
                args: [
                    [parseInt(itemId)],
                    {
                        'mega_menu_classes': classes.join(' '),
                    },
                ],
            }));
        }

        await Promise.all(promises);
    },
    /**
     * Save all "newsletter" blocks.
     *
     * @private
     */
    _saveNewsletterBlocks: async function () {
        const defs = [];
        await this.editor.execCommand(async () => {
            defs.push(this._super.apply(this, arguments));
            const $popups = $(this.editorEditable).find('.o_newsletter_popup');
            for (const popup of $popups) {
                const $popup = $(popup);
                const content = $popup.data('content');
                if (content) {
                    defs.push(this._rpc({
                        route: '/website_mass_mailing/set_content',
                        params: {
                            'newsletter_id': parseInt($popup.attr('data-list-id')),
                            'content': content,
                        },
                    }));
                }
            }
        });
        return Promise.all(defs);
    },
    /**
     * Save all modified images.
     *
     * @private
     */
    _saveModifiedImages: async function () {
        await this.editor.execCommand(async (context) => {
            const defs = _.map(this._getEditable($('#wrapwrap')), async editableEl => {
                const {oeModel: resModel, oeId: resId} = editableEl.dataset;
                const proms = [...editableEl.querySelectorAll('.o_modified_image_to_save')].map(async el => {
                    const isBackground = !el.matches('img');
                    el.classList.remove('o_modified_image_to_save');

                    await this.editorHelpers.removeClass(context, el, 'o_modified_image_to_save');
                    // Modifying an image always creates a copy of the original, even if
                    // it was modified previously, as the other modified image may be used
                    // elsewhere if the snippet was duplicated or was saved as a custom one.
                    const newAttachmentSrc = await this._rpc({
                        route: `/web_editor/modify_image/${el.dataset.originalId}`,
                        params: {
                            res_model: resModel,
                            res_id: parseInt(resId),
                            data: (isBackground ? el.dataset.bgSrc : el.getAttribute('src')).split(',')[1],
                        },
                    });
                    if (isBackground) {
                        await this.editorHelpers.setStyle(context, el, 'background-image', `url('${newAttachmentSrc}')`);
                        await this.editorHelpers.setAttribute(context, el, 'data-bgSrc', '');
                    } else {
                        await this.editorHelpers.setAttribute(context, el, 'src', newAttachmentSrc);
                    }
                });
                return Promise.all(proms);
            });
            await Promise.all(defs);
        });
    },
    /**
     * Initialize the editor for a translation.
     *
     * @private
     */
    _setupTranslation: function () {
        const attrs = ['placeholder', 'title', 'alt'];
        const nodesToTranslateAttributes = this.vEditable.descendants(node => {
            const attributes = node.modifiers.find(JWEditorLib.Attributes);
            return attributes && attributes.keys().some(key => attrs.includes(key));
        });
        const domNodesToTranslateAttributes = nodesToTranslateAttributes.flatMap(nodeToTranslateAttributes => {
            return this.editorHelpers.getDomNodes(nodeToTranslateAttributes)[0];
        });
        this.$nodesToTranslateAttributes = $(domNodesToTranslateAttributes);
        for (const attr of attrs) {
            this.$nodesToTranslateAttributes.each(function () {
                var $node = $(this);
                var translation = $node.data('translation') || {};
                var attributeTranslation = $node.attr(attr);
                if (attributeTranslation) {
                    var match = attributeTranslation.match(/<span [^>]*data-oe-translation-id="([0-9]+)"[^>]*>(.*)<\/span>/);
                    var $translatedAttributeNode = $(attributeTranslation).addClass('d-none o_editable o_editable_translatable_attribute').appendTo('body');
                    $translatedAttributeNode.data('$node', $node).data('attribute', attr);

                    translation[attr] = $translatedAttributeNode[0];
                    if (match) {
                        $node.attr(attr, match[2]);
                    }
                }
                var select2 = $node.data('select2');
                if (select2) {
                    select2.blur();
                    $node.on('translate', function () {
                        select2.blur();
                    });
                    $node = select2.container.find('input');
                }
                $node.addClass('o_translatable_attribute').data('translation', translation);
            });
        }
        this.$attribute_translations = $('.o_editable_translatable_attribute');
        this.translations = [];
        this._markTranslatableNodes();

        // We don't want the BS dropdown to close
        // when clicking in a element to translate
        $('.dropdown-menu').on('click', '.o_editable', function (ev) {
            ev.stopPropagation();
        });
    },
    /**
     * Called when a demand to open a alt dialog is received on the bus.
     *
     * @private
     * @param {Object} data
     */
    _onAltDialogDemand: function (data) {
        if (data.__alreadyDone) {
            return;
        }
        data.__alreadyDone = true;
        var altDialog = new weWidgets.AltDialog(this,
            data.options || {},
            data.media
        );
        if (data.onSave) {
            altDialog.on('save', this, data.onSave);
        }
        if (data.onCancel) {
            altDialog.on('cancel', this, data.onCancel);
        }
        altDialog.open();
    },
    /**
     * Called when a demand to open a "crop image" dialog is received on the
     * bus.
     *
     * @private
     * @param {Object} data
     */
    _onCropImageDialogDemand: function (data) {
        if (data.__alreadyDone) {
            return;
        }
        data.__alreadyDone = true;
        var cropImageDialog = new weWidgets.CropImageDialog(this,
            _.extend({
                res_model: data.$editable.data('oe-model'),
                res_id: data.$editable.data('oe-id'),
            }, data.options || {}),
            data.media
        );
        if (data.onSave) {
            cropImageDialog.on('save', this, data.onSave);
        }
        if (data.onCancel) {
            cropImageDialog.on('cancel', this, data.onCancel);
        }
        cropImageDialog.open();
    },
    /**
     * Called when a demand to open a link dialog is received on the bus.
     *
     * @private
     * @param {Object} data
     */
    _onLinkDialogDemand: function (data) {
        if (data.__alreadyDone) {
            return;
        }
        data.__alreadyDone = true;
        var linkDialog = new weWidgets.LinkDialog(this,
            data.options || {},
            data.$editable,
            data.linkInfo
        );
        if (data.onSave) {
            linkDialog.on('save', this, data.onSave);
        }
        if (data.onCancel) {
            linkDialog.on('cancel', this, data.onCancel);
        }
        linkDialog.open();
    },
    /**
     * Called when a demand to open a media dialog is received on the bus.
     *
     * @private
     * @param {Object} data
     */
    _onMediaDialogDemand: function (data) {
        if (data.__alreadyDone) {
            return;
        }
        data.__alreadyDone = true;

        var mediaDialog = new weWidgets.MediaDialog(this,
            _.extend({
                res_model: data.$editable.data('oe-model'),
                res_id: data.$editable.data('oe-id'),
                domain: data.$editable.data('oe-media-domain'),
            }, data.options),
            data.media
        );
        if (data.onSave) {
            mediaDialog.on('save', this, data.onSave);
        }
        if (data.onCancel) {
            mediaDialog.on('cancel', this, data.onCancel);
        }
        mediaDialog.open();
    },
    /**
     * Save all translation blocks.
     *
     * @private
     */
    _onSaveTranslation: async function () {
        const defs = [];
        this.trigger_up('edition_will_stopped');
        this.trigger_up('ready_to_save', {defs: defs});
        await Promise.all(defs);

        const promises = [];
        // Get the nodes holding the `OdooTranslationFormats`. Only one
        // node per format.
        const translationIds = [];
        const translationNodes = this.vEditable.descendants(descendant => {
            const format = descendant.modifiers.find(JWEditorLib.OdooTranslationFormat);
            const translationId = format && format.translationId;
            if (!format || translationIds.includes(translationId)) {
                return false;
            } else if (translationId) {
                translationIds.push(translationId);
            }
            // Only save editable nodes.
            return this.editor.mode.is(descendant, 'editable');
        });

        // Save the odoo translation formats.
        for (const translationNode of translationNodes) {
            const renderer = this.editor.plugins.get(JWEditorLib.Renderer);
            const renderedNode = (await renderer.render('dom/html', translationNode))[0];
            const translationFormat = translationNode.modifiers.find(JWEditorLib.OdooTranslationFormat);

            let $renderedTranslation = $(renderedNode);
            if (!$renderedTranslation.data('oe-translation-state')) {
                $renderedTranslation = $renderedTranslation.find('[data-oe-translation-state]');
            }

            if (translationFormat.translationId) {
                promises.push(this._saveTranslationTo($renderedTranslation, +translationFormat.translationId));
            } else {
                const attributes = translationFormat.modifiers.find(JWEditorLib.Attributes);
                promises.push(this._saveViewTo(
                    $renderedTranslation,
                    attributes.get('data-oe-id'),
                    attributes.get('data-oe-xpath')
                ));
            }
        }

        // Save attributes
        for (const attribute_translation of this.$attribute_translations) {
            const $attribute_translations = $(attribute_translation);
            promises.push(this._saveTranslationTo(
                $attribute_translations,
                +$attribute_translations.data('oe-translation-id')
            ));
        }

        await Promise.all(promises);
        this.trigger_up('edition_was_stopped');
        window.location.reload();
    },
    /**
     * Returns the editable areas on the page.
     *
     * @param {JQuery} $element
     * @returns {JQuery}
     */
    _getEditable($element) {
        return $element.find('[data-oe-model]')
            .not('.o_not_editable')
            .filter(function () {
                var $parent = $(this).closest('.o_editable, .o_not_editable');
                return !$parent.length || $parent.hasClass('o_editable');
            })
            .not('link, script')
            .not('[data-oe-readonly]')
            .not('img[data-oe-field="arch"], br[data-oe-field="arch"], input[data-oe-field="arch"]')
            .not('.oe_snippet_editor')
            .not('hr, br, input, textarea')
            .add('.o_editable');
    },
    /**
     * Additional binding after start.
     *
     * Meant to be overridden
     */
    _bindAfterStart() {},
});

//--------------------------------------------------------------------------
// Public helper
//--------------------------------------------------------------------------
/**
 * @param {Node} node (editable or node inside)
 * @returns {Object}
 * @returns {Node} sc - start container
 * @returns {Number} so - start offset
 * @returns {Node} ec - end container
 * @returns {Number} eo - end offset
 */
Wysiwyg.getRange = function (node) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    var result = range && {
        sc: range.startContainer,
        so: range.startOffset,
        ec: range.endContainer,
        eo: range.endOffset,
    };
    return result;
};
/**
 * @param {Node} startNode
 * @param {Number} startOffset
 * @param {Node} endNode
 * @param {Number} endOffset
 */
Wysiwyg.setRange = async function (wysiwyg, startNode, startOffset, endNode, endOffset) {
    endNode = endNode || startNode;
    endOffset = endOffset || startOffset-1;

    await wysiwyg.editor.execCommand(async () => {
        const startVNode = wysiwyg.editorHelpers.getNodes(startNode);
        const endVNode = wysiwyg.editorHelpers.getNodes(endNode);
        wysiwyg.editor.selection.select(startVNode[startOffset], endVNode[endOffset]);
    });
};

return Wysiwyg;
});
