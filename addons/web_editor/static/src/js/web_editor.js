odoo.define('web_editor.wysiwyg', function (require) {
'use strict';

var config = require('web.config');
var ajax = require('web.ajax');
var core = require('web.core');
var session = require('web.session');
var Widget = require('web.Widget');
var Editor = window.we3;

var _t = core._t;
var QWeb = core.qweb;


var Wysiwyg = Widget.extend({
    templatesDependencies: [
        '/web_editor/static/src/xml/wysiwyg.xml',
    ],
    custom_events: {
        getRecordInfo: '_onGetRecordInfo',
        change: '_onChange',
        // imageUpload : '_onImageUpload',
    },
    defaultOptions: {
        codeview: config.isDebug(),
    },

    /**
     * @params {Object} params
     * @params {Object} params.recordInfo
     * @params {Object} params.recordInfo.context
     * @params {String} [params.recordInfo.context]
     * @params {integer} [params.recordInfo.res_id]
     * @params {String} [params.recordInfo.data_res_model]
     * @params {integer} [params.recordInfo.data_res_id]
     *   @see _onGetRecordInfo
     *   @see _getAttachmentsDomain in /wysiwyg/widgets/media.js
     * @params {Object} params.attachments
     *   @see _onGetRecordInfo
     *   @see _getAttachmentsDomain in /wysiwyg/widgets/media.js (for attachmentIDs)
     * @params {function} params.generateOptions
     *   called with the summernote configuration object used before sending to summernote
     *   @see _editorOptions
     **/
    init: function (parent, params) {
        this._super.apply(this, arguments);
        this.options = _.extend({}, this.defaultOptions, params);
        this.attachments = this.options.attachments || [];
        this.hints = [];
        this.$el = null;
        this._dirty = false;
    },
    /**
     * Load assets and color picker template then call summernote API
     * and replace $el by the summernote editable node.
     *
     * @override
     **/
    willStart: function () {
        var self = this;
        this.$target = this.$el;
        this.$el = null; // temporary null to avoid hidden error, setElement when start
        return this._super()
            .then(function () {
                var defs = [self._getColors()];
                if (self.options.snippets) {
                    defs.push(self._loadDropBlocks());
                }
                return $.when.apply($, defs);
            })
            .then(function () {
                self.editor = new Editor(self, self._editorOptions());
                return $.when(self.editor.isInitialized());
            });
    },
    /**
     *
     * @override
     */
    start: function () {
        var self = this;
        return this.editor.start(this.$target[0]).then(function () {
            self.setElement(self.editor.editor);
        });
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * Set the focus on the element.
     */
    focus: function () {
        this.editor.focus();
    },
    save: function () {
        return this.editor.save();
    },
    setValue: function (value) {
        return this.editor.value = value;
    },
    getValue: function () {
        return this.editor.value;
    },
    isDirty: function () {
        return this.editor.isDirty;
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @returns {Object} the summernote configuration
     */
    _editorOptions: function () {
        var options = Object.assign({}, this.options, {
            lang : "odoo",
            disableDragAndDrop : !!this.options.noAttachment,
            styleTags: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre'],
            colors: this._groupColors,
            dropblocks: this._dropblocks,
            blockSelector: this._blockSelector,
            renderingAttributeBlacklist: ['data-oe-model', 'data-oe-id', 'data-oe-path', 'data-oe-type', 'data-oe-field', 'data-oe-many2one-id'],
            renderTemplate: this._renderTemplate.bind(this),
            loadTemplates: this._loadTemplates.bind(this),
            translate: this._translate.bind(this),
            getXHR: this._getXHR.bind(this),
            upload: {
                onUpload: this._onMediaUpload.bind(this),
                onSelect: this._onMediaSelect.bind(this),
                add: '/web_editor/attachment/add',
                remove: '/web_editor/attachment/remove',
                search: '/web/dataset/call_kw/ir.attachment/search_read',
            },
            xhr: {
                csrf_token: odoo.csrf_token,
                user_id: session.uid || session.user_id,
                res_id: this.options.recordInfo && this.options.recordInfo.res_id,
                res_model: this.options.recordInfo && this.options.recordInfo.res_model,
            },
        });
        if (this.options.snippets) {
            options.plugins = Object.assign({
                DropBlockSelector: true,
                customizeBlock: true,
            }, options.plugins);

            options.toolbar = [
                'DropBlock',
                'FontStyle',
                'FontSize',
                // 'FontName',
                'ForeColor', 'BgColor',
                'List',
                'Paragraph',
                'TablePicker',
                'LinkCreate',
                'Media',
                'History',
                'CodeView',
                'FullScreen',
                'KeyMap',
            ];
        }

        if (this.options.generateOptions) {
            this.options.generateOptions(options);
        }
        return options;
    },
    /**
     * Returns the domain for attachments used in media dialog.
     * We look for attachments related to the current document. If there is a value for the model
     * field, it is used to search attachments, and the attachments from the current document are
     * filtered to display only user-created documents.
     * In the case of a wizard such as mail, we have the documents uploaded and those of the model
     *
     * @private
     * @params {string} needle
     * @returns {Array} "ir.attachment" odoo domain.
     */
    _getAttachmentsDomain: function (needle, isDocument) {
        var xhrOptions = this.editor.options.xhr;
        var domain = this.options.attachmentIDs && this.options.attachmentIDs.length ? ['|', ['id', 'in', this.options.attachmentIDs]] : [];

        var attachedDocumentDomain = [
            '&',
            ['res_model', '=', xhrOptions.res_model],
            ['res_id', '=', xhrOptions.res_id|0]
        ];
        // if the document is not yet created, do not see the documents of other users
        if (!xhrOptions.res_id) {
            attachedDocumentDomain.unshift('&');
            attachedDocumentDomain.push(['create_uid', '=', xhrOptions.user_id]);
        }
        if (xhrOptions.data_res_model) {
            var relatedDomain = ['&',
                ['res_model', '=', xhrOptions.data_res_model],
                ['res_id', '=', xhrOptions.data_res_id|0]];
            if (!xhrOptions.data_res_id) {
                relatedDomain.unshift('&');
                relatedDomain.push(['create_uid', '=', session.uid]);
            }
            domain = domain.concat(['|'], attachedDocumentDomain, relatedDomain);
        } else {
            domain = domain.concat(attachedDocumentDomain);
        }
        domain = ['|', ['public', '=', true]].concat(domain);

        domain.push('|',
            ['mimetype', '=', false],
            ['mimetype', isDocument ? 'not in' : 'in', ['image/gif', 'image/jpe', 'image/jpeg', 'image/jpg', 'image/gif', 'image/png']]);
        if (needle && needle.length) {
            domain.push('|', ['datas_fname', 'ilike', needle], ['name', 'ilike', needle]);
        }
        domain.push('|', ['datas_fname', '=', false], '!', ['datas_fname', '=like', '%.crop'], '!', ['name', '=like', '%.crop']);
        return domain;
    },
    /**
     * Return an object describing the linked record.
     *
     * @private
     * @param {Object} options
     * @returns {Object} {res_id, res_model, xpath}
     */
    _getRecordInfo: function (options) {
        var data = this.options.recordInfo || {};
        if (typeof data === 'function') {
            data = data(options);
        }
        if (!data.context) {
            throw new Error("Context is missing");
        }
        return data;
    },
    _getColors: function () {
        var self = this;
        var def = $.when();
        if (!('web_editor.colorpicker' in QWeb.templates)) {
            var def = this._rpc({
                model: 'ir.ui.view',
                method: 'read_template',
                args: ['web_editor.colorpicker'],
            }).then(function (template) {
                return QWeb.add_template('<templates>' + template + '</templates>');
            });
        }

        return def.then(function () {
            var groupColors = [];
            var $clpicker = $(QWeb.render('web_editor.colorpicker'));
            $clpicker.children('.o_colorpicker_section').each(function () {
                groupColors.push($(this).attr('data-display'));
                var colors = [];
                $(this.children).each(function () {
                    if ($(this).hasClass('clearfix')) {
                        groupColors.push(colors);
                        colors = [];
                    } else {
                        colors.push($(this).attr('data-color') || '');
                    }
                });
                groupColors.push(colors);
            });

            groupColors = groupColors.concat([
                'Grey',
                ['#000000', '#424242', '#636363', '#9C9C94', '#CEC6CE', '#EFEFEF', '#F7F7F7', '#FFFFFF'],
                'Colors',
                ['#FF0000', '#FF9C00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#9C00FF', '#FF00FF'],
                ['#F7C6CE', '#FFE7CE', '#FFEFC6', '#D6EFD6', '#CEDEE7', '#CEE7F7', '#D6D6E7', '#E7D6DE'],
                ['#E79C9C', '#FFC69C', '#FFE79C', '#B5D6A5', '#A5C6CE', '#9CC6EF', '#B5A5D6', '#D6A5BD'],
                ['#E76363', '#F7AD6B', '#FFD663', '#94BD7B', '#73A5AD', '#6BADDE', '#8C7BC6', '#C67BA5'],
                ['#CE0000', '#E79439', '#EFC631', '#6BA54A', '#4A7B8C', '#3984C6', '#634AA5', '#A54A7B'],
                ['#9C0000', '#B56308', '#BD9400', '#397B21', '#104A5A', '#085294', '#311873', '#731842'],
                ['#630000', '#7B3900', '#846300', '#295218', '#083139', '#003163', '#21104A', '#4A1031']
            ]);

            self._groupColors = groupColors;
        });
    },
    _getXHR: function (pluginName, url, values, superGetXHR) {
        var self = this;
        if (url === '/web/dataset/call_kw/ir.attachment/search_read') {
            return this._rpc({
                model: 'ir.attachment',
                method: 'search_read',
                domain: this._getAttachmentsDomain(values.search, pluginName === 'UploadDocument'),
                fields: ['name', 'datas_fname', 'mimetype', 'checksum', 'url', 'type', 'res_id', 'res_model', 'access_token'],
                order: [{name: 'id', asc: false}],
                limit: values.limit,
                offset: values.offset,
            }).then(function (records) {
                return records.map(self._convertOdooRecordToMediaPlugin.bind(self, pluginName));
            });
        }
        if (url === '/web_editor/attachment/remove') {
            debugger;
        }
        throw new Error("XHR route missing");
    },
    /**
     * Load snippets.
     */
    _loadDropBlocks: function () {
        var self = this;
        var def = $.when();
        if (!('web_editor.dropBlockTemplate.custom' in QWeb.templates)) {
            var def = this._rpc({
                model: 'ir.ui.view',
                method: 'render_template',
                args: [this.options.snippets, {}],
            }).then(function (template) {
                var t = document.createElement('t');
                t.setAttribute('t-name', 'web_editor.dropBlockTemplate.custom');
                t.innerHTML = template;
                var xml = new XMLSerializer().serializeToString(t).replace(/\s*xmlns="[^"]+"/, '');
                QWeb.add_template('<templtes>' + xml + '</templtes>');
            })
        }

        return def.then(function () {
            var dropblocks = [];
            var blockSelector = [];
            var blockCustomisation = [];

            var $dropBlockTemplate = $(QWeb.render('web_editor.dropBlockTemplate.custom'));
            $dropBlockTemplate.filter('#o_scroll').find('.o_panel').each(function () {
                var blocks = [];
                $(this).find('.o_panel_body').children().each(function () {
                    blocks.push({
                        title: (this.getAttribute('name') + '').trim(),
                        thumbnail: this.dataset.oeThumbnail,
                        content: this.innerHTML.trim(),
                    });
                });
                dropblocks.push({
                    title: $(this).find('.o_panel_header').html().trim(),
                    blocks: blocks,
                });
            });

            $dropBlockTemplate.filter('#snippet_options').children().each(function () {
                var data = $(this).data();
                blockSelector.push({
                    selector: data.selector,
                    exclude: data.exclude,
                    dropIn: data.dropIn,
                    dropNear: data.dropNear,
                    customizeAllowNotEditable: data.noCheck,
                    customizeType: data.js,
                    customizeTargets: data.target,
                });

                //TODO QSM: => colorPrefix , paletteTitle, paletteDefault, paletteExclude


                var menu = [];
                $(this).children().each(function () {
                    var $child = $(this);
                    if ($child.hasClass('dropdown-submenu')) {
                        // console.log(this);
                        var submenu = [];
                        $child.each(function () {

                        });
                    } else {

                    }
                });

                data.menu = menu;
                blockCustomisation.push(data);
            });

            // console.log('------------------');
            // // console.log(dropblocks);
            // console.log(blockSelector);
            // console.log(blockCustomisation);
            // console.log('------------------');

            console.log(blockSelector);

            self._dropblocks = dropblocks;
            self._blockSelector = blockSelector;
            self._blockCustomisation = blockCustomisation;
        });
    },
    _loadTemplates: function (xmlPaths) {
        var promises = [];
        var xmlPath;
        while ((xmlPath = xmlPaths.shift())) {
            xmlPath = xmlPath[0] === '/' ? xmlPath : we3.options.xhrPath + xmlPath;
            promises.push(ajax.loadXML(xmlPath, QWeb));
        }
        return $.when.apply($, promises);
    },
    _onMediaSelect: function (pluginName, record, element) {
        var self = this;
        var promise = Promise.resolve();
        if (record.id && !record.access_token) {
            promise = new Promise(function (resolve) {
                self._rpc({
                    model: 'ir.attachment',
                    method: 'generate_access_token',
                    args: [[record.id]]
                }).then(function (access_token) {
                    record.access_token = access_token[0];
                    resolve();
                });
            })
        }

        var res_model = this.editor.options.xhr.res_model;
        var isDocument = !(/gif|jpe|jpg|png/.test(record.mimetype) || /gif|jpe|jpg|png/.test(record.url.split('.').pop()));

        return promise.then(function () {
            if (record.url.indexOf('access_token=') === -1 && record.access_token && res_model !== 'ir.ui.view') {
                record.url += _.str.sprintf('?access_token=%s', record.access_token);
            }
            if (element.tagName === 'A') {
                if (record.checksum) {
                    if (record.url.indexOf('?') === -1) {
                        record.url += '?';
                    }
                    record.url += 'unique=' + record.checksum + '&download=true';
                    element.setAttribute('href', record.url);
                }
            } else {
                element.setAttribute('src', record.url);
                // Note: by default the images receive the bootstrap opt-in
                // img-fluid class. We cannot make them all responsive
                // by design because of libraries and client databases img.
                element.classList.add('img-fluid');
                element.classList.add('o_we_custom_image');
            }
            return element;
        });
    },
    _onMediaUpload: function (pluginName, records) {
        return records.map(this._convertOdooRecordToMediaPlugin.bind(this, pluginName));
    },
    _convertOdooRecordToMediaPlugin: function (pluginName, record) {
        var url = record.url;
        if (!url) {
            url = '/web/' + (pluginName === 'UploadImage' ? 'image' : 'content') + '/' + record.id;
            url += '/' + encodeURI(record.title || record.name); // Name is added for SEO purposes
            if (record.access_token) {
                url += _.str.sprintf('?access_token=%s', record.access_token);
            }
        }
        record.url = url;
        record.alt = record.datas_fname;
        record.title = record.name || record.datas_fname;
        return record;
    },
    _renderTemplate: function (pluginName, template, values) {
        return QWeb.render(template, values);
    },
    _select: function (range) {
        var nativeRange = range.toNativeRange();
        var selection = range.getSelection();
        if (selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
        selection.addRange(nativeRange);
        var sc = nativeRange.startContainer;
        $(sc.tagName ? sc : sc.parentNode).trigger('wysiwyg.range');
        return range;
    },
    _translate: function (pluginName, string) {
        string = string.replace(/\s\s+/g, ' ');
        return _t(string);
    },

    //--------------------------------------------------------------------------
    // Handler
    //--------------------------------------------------------------------------

    /**
     * trigger_up 'wysiwyg_change'
     *
     * @private
     * @param {OdooEvent} ev
     */
    _onChange: function (ev) {
        // if (this.hints.length) {
        //     var hints = [];
        //     _.each(this.hints, function (hint) {
        //         if (html.indexOf('@' + hint.name) !== -1) {
        //             hints.push(hint);
        //         }
        //     });
        //     this.hints = hints;
        // }

        ev.stopPropagation();
        this.trigger_up('wysiwyg_change', {
            html: this.getValue(),
            hints: this.hints,
            attachments: this.attachments,
        });
    },
    /**
     * trigger_up 'wysiwyg_attachment' when add an image found in the view.
     *
     * This method is called when an image is uploaded by the media dialog and returns the
     * object attachment as recorded in the "ir.attachment" model, via a wysiwyg_attachment event.
     *
     * For e.g. when sending email, this allows people to add attachments with the content
     * editor interface and that they appear in the attachment list.
     * The new documents being attached to the email, they will not be erased by the CRON
     * when closing the wizard.
     *
     * @private
     */
    _onImageUpload: function (attachments) {
        var self = this;
        attachments = _.filter(attachments, function (attachment) {
            return !_.findWhere(self.attachments, {
                id: attachment.id,
            });
        });
        if (!attachments.length) {
            return;
        }
        this.attachments = this.attachments.concat(attachments);

        // todo remove image not in the view

        this.trigger_up.bind(this, 'wysiwyg_attachment', this.attachments);
    },
    /**
     * Do not override.
     *
     * @see _getRecordInfo
     * @private
     * @param {OdooEvent} ev
     * @param {Object} ev.data
     * @param {Object} ev.data.recordInfo
     * @param {Function(recordInfo)} ev.data.callback
     */
    _onGetRecordInfo: function (ev) {
        var data = this._getRecordInfo(ev.data);
        data.attachmentIDs = _.pluck(this.attachments, 'id');
        data.user_id = session.uid || session.user_id;
        ev.data.callback(data);
    },
});

//--------------------------------------------------------------------------
// Public helper
//--------------------------------------------------------------------------

/**
 * Load wysiwyg assets if needed.
 *
 * @see Wysiwyg.createReadyFunction
 * @param {Widget} parent
 * @returns {$.Promise}
 */
Wysiwyg.prepare = (function () {
    var assetsLoaded = false;
    var def;
    return function prepare(parent) {
        if (assetsLoaded) {
            return $.when();
        }
        if (def) {
            return def;
        }
        def = $.Deferred();
        var timeout = setTimeout(function () {
            throw _t("Can't load assets of the wysiwyg editor");
        }, 10000);
        var wysiwyg = new Wysiwyg(parent, {
            recordInfo: {
                context: {},
            }
        });
        wysiwyg.attachTo($('<textarea>')).then(function () {
            assetsLoaded = true;
            clearTimeout(timeout);
            wysiwyg.destroy();
            def.resolve();
        });
        return def;
    };
})();

//--------------------------------------------------------------------------
// jQuery extensions
//--------------------------------------------------------------------------

$.extend($.expr[':'], {
    o_editable: function (node, i, m) {
        while (node) {
            if (node.attributes) {
                if (
                    node.classList.contains('o_not_editable') ||
                    (node.attributes.contenteditable &&
                        node.attributes.contenteditable.value !== 'true' &&
                        !node.classList.contains('o_fake_not_editable'))
                ) {
                    return false;
                }
                if (
                    node.classList.contains('o_editable') ||
                    (node.attributes.contenteditable &&
                        node.attributes.contenteditable.value === 'true' &&
                        !node.classList.contains('o_fake_editable'))
                ) {
                    return true;
                }
            }
            node = node.parentNode;
        }
        return false;
    },
});

return Wysiwyg;
});
