odoo.define('web_editor.wysiwyg.multizone.translate', function (require) {
'use strict';

var core = require('web.core');
var webDialog = require('web.Dialog');
var WysiwygMultizone = require('web_editor.wysiwyg.multizone');
var rte = require('web_editor.rte');
var Dialog = require('wysiwyg.widgets.Dialog');
var websiteNavbarData = require('website.navbar');
var weWidgets = require('wysiwyg.widgets');

var _t = core._t;


var RTETranslatorWidget = rte.Class.extend({
    /**
     * If the element holds a translation, saves it. Otherwise, fallback to the
     * standard saving but with the lang kept.
     *
     * @override
     */
    _saveElement: function ($el, context, withLang) {
        var self = this;
        if ($el.data('oe-translation-id')) {
            return this._rpc({
                model: 'ir.translation',
                method: 'save_html',
                args: [
                    [+$el.data('oe-translation-id')],
                    this._getEscapedElement($el).html()
                ],
                context: context,
            });
        }
        return this._super($el, context, withLang === undefined ? true : withLang);
    },
});

var AttributeTranslateDialog = Dialog.extend({
    template: 'website.AttributeTranslateDialog',
    xmlDependencies: Dialog.prototype.xmlDependencies.concat(
        ['/website/static/src/xml/translator.xml']
    ),
    events: {
        'input input[data-attr]': '_onChangeInput',
        'click .translate_img_preview': '_onClickImagePreview',
    },
    /**
     * @constructor
     */
    init: function (parent, options, node) {
        this._super(parent, _.extend({
            title: _t("Translate Attributes"),
            buttons: [
                {text:  _t("Close"), close: true}
            ],
        }, options || {}));
        this.translation = $(node).data('translation');
        this.attributeData = {
            title: {
                string: _t("Tooltip"),
                substring: _t("(TITLE ATTRIBUTE)"),
                title: _t("This string will be displayed as a tooltip when you hover on element.")
            },
            alt: {
                string: _t("Image Description"),
                substring: _t("(ALT ATTRIBUTE)"),
                title: _t("This string will be displayed when image is not found.")
            },
            src: {
                string: _t("Image"),
                title: _t("Click to change image")
            },
            placeholder: {
                string: _t("Placeholder"),
                title: _t("Placeholder will be displayed when input is empty.")},
        };
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    /**
    * Apply translation when an input changes.
    */
    _onChangeInput: function (ev) {
        var $input = $(ev.currentTarget);
        var node = this.translation[$input.data('attr')];
        var $node = $(node);
        var value = $input.val();
        $node.html(value).trigger('change', node);
        $node.data('$node').attr($node.data('attribute'), value).trigger('translate');
        $node.trigger('change');
    },
    /**
     * Open media dialog to select translated image
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickImagePreview: function (ev) {
        var self = this;
        var $image = $(ev.currentTarget).find('img');
        var mediaDialog = new weWidgets.MediaDialog(this, {
            onlyImages: true,
        }, $image);
        mediaDialog.open();
        mediaDialog.on('save', this, function () {
            self.$('input[data-attr="src"]').attr('value', $image.attr('src')).trigger('input');
        });
    }
});

var WysiwygTranslate = WysiwygMultizone.extend({
    custom_events: _.extend({}, WysiwygMultizone.prototype.custom_events || {}, {
        ready_to_save: '_onSave',
    }),

    /**
     * @override
     * @param {string} options.lang
     */
    init: function (parent, options) {
        this.lang = options.lang;
        options.recordInfo = _.defaults({
                context: {lang: this.lang}
            }, options.recordInfo, options);
        this._super.apply(this, arguments);
    },
    /**
     * @override
     */
    start: function () {
        var self = this;
        this.editor = new (this.Editor)(this, Object.assign({Editor: RTETranslatorWidget}, this.options));
        this.$editor = this.editor.rte.editable();
        var promise = this.editor.prependTo(this.$editor[0].ownerDocument.body);

        return promise.then(function () {
            self._relocateEditorBar();
            var attrs = ['placeholder', 'title', 'alt', 'src'];
            _.each(attrs, function (attr) {
                self._getEditableArea().filter('[' + attr + '*="data-oe-translation-id="]').filter(':empty, input, select, textarea, img').each(function () {
                    var $node = $(this);
                    var translation = $node.data('translation') || {};
                    var trans = $node.attr(attr);
                    var match = trans.match(/<span [^>]*data-oe-translation-id="([0-9]+)"[^>]*>(.*)<\/span>/);
                    var $trans = $(trans).addClass('d-none o_editable o_editable_translatable_attribute').appendTo('body');
                    $trans.data('$node', $node).data('attribute', attr);

                    translation[attr] = $trans[0];
                    $node.attr(attr, match[2]);

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
            });

            self.translations = [];
            self.$editables_attr = self._getEditableArea().filter('.o_translatable_attribute');
            self.$editables_attribute = $('.o_editable_translatable_attribute');

            self.$editables_attribute.on('change', self._onChange.bind(self));

            self._markTranslatableNodes();
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @override
     * @returns {Boolean}
     */
    isDirty: function () {
        return this._super() || this.$editables_attribute.hasClass('o_dirty');
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Return the editable area.
     *
     * @override
     * @returns {JQuery}
     */
    _getEditableArea: function () {
        var $editables = this._super();
        return $editables.add(this.$editables_attribute);
    },
    /**
     * Return an object describing the linked record.
     *
     * @override
     * @param {Object} options
     * @returns {Object} {res_id, res_model, xpath}
     */
    _getRecordInfo: function (options) {
        options = options || {};
        var recordInfo = this._super(options);
        var $editable = $(options.target).closest(this._getEditableArea());
        if (!$editable.length) {
            $editable = $(this._getFocusedEditable());
        }
        recordInfo.context.lang = this.lang;
        recordInfo.translation_id = $editable.data('oe-translation-id')|0;
        return recordInfo;
    },
    /**
     * @override
     * @returns {Object} the summernote configuration
     */
    _editorOptions: function () {
        var options = this._super();
        options.toolbar = [
            // todo: hide this feature for field (data-oe-model)
            ['font', ['bold', 'italic', 'underline', 'clear']],
            ['fontsize', ['fontsize']],
            ['color', ['color']],
            // keep every time
            ['history', ['undo', 'redo']],
        ];
        return options;
    },
    /**
     * Called when text is edited -> make sure text is not messed up and mark
     * the element as dirty.
     *
     * @override
     * @param {Jquery Event} [ev]
     */
    _onChange: function (ev) {
        var $node = $(ev && ev.target || this._getFocusedEditable());
        if (!$node.length) {
            return;
        }
        $node.find('p').each(function () { // remove <p/> element which might have been inserted because of copy-paste
            var $p = $(this);
            $p.after($p.html()).remove();
        });
        var trans = this._getTranlationObject($node[0]);
        $node.toggleClass('o_dirty', trans.value !== $node.html().replace(/[ \t\n\r]+/, ' '));
    },
    /**
     * Returns a translation object.
     *
     * @private
     * @param {Node} node
     * @returns {Object}
     */
    _getTranlationObject: function (node) {
        var $node = $(node);
        var id = +$node.data('oe-translation-id');
        if (!id) {
            id = $node.data('oe-model')+','+$node.data('oe-id')+','+$node.data('oe-field');
        }
        var trans = _.find(this.translations, function (trans) {
            return trans.id === id;
        });
        if (!trans) {
            this.translations.push(trans = {'id': id});
        }
        return trans;
    },
    /**
     * @private
     */
    _markTranslatableNodes: function () {
        var self = this;
        this._getEditableArea().each(function () {
            var $node = $(this);
            var trans = self._getTranlationObject(this);
            trans.value = (trans.value ? trans.value : $node.html() ).replace(/[ \t\n\r]+/, ' ');
        });
        this._getEditableArea().prependEvent('click.translator', function (ev) {
            if (ev.ctrlKey || !$(ev.target).is(':o_editable')) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
        });

        // attributes

        this.$editables_attr.each(function () {
            var $node = $(this);
            var translation = $node.data('translation');
            _.each(translation, function (node, attr) {
                var trans = self._getTranlationObject(node);
                trans.value = (trans.value ? trans.value : $node.html() ).replace(/[ \t\n\r]+/, ' ');
                $node.attr('data-oe-translation-state', (trans.state || 'to_translate'));
            });
        });

        this.$editables_attr.prependEvent('mousedown.translator click.translator mouseup.translator', function (ev) {
            if (ev.ctrlKey) {
                return;
            }
            ev.preventDefault();
            ev.stopPropagation();
            if (ev.type !== 'mousedown') {
                return;
            }

            new AttributeTranslateDialog(self, {}, ev.target).open();
        });
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onSave: function (ev) {
        ev.stopPropagation();
    },
});

return WysiwygTranslate;
});
