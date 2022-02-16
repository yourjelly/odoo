odoo.define('knowledge.wysiwyg', function (require) {
'use strict';

const core = require('web.core');
const QWeb = core.qweb;

const { DialogLinkWidget } = require('wysiwyg.widgets.LinkDialog');
const { DocumentWidget } = require('wysiwyg.widgets.media');
const MediaDialog = require('wysiwyg.widgets.MediaDialog');
const Wysiwyg = require('web_editor.wysiwyg');

const CustomDocumentWidget = DocumentWidget.extend({
    /**
     * @param {Object} img
     * @returns {HTMLElement}
     */
    _renderMedia: function (img) {
        let src = '';
        if (img.image_src) {
            src = img.image_src;
            if (!img.public && img.access_token) {
                src += _.str.sprintf('?access_token=%s', img.access_token);
            }
        }

        const dom = $(QWeb.render('knowledge.file_block', {
            img: img,
            src: src
        }));
        this.$media = dom;
        this.media = dom[0];

        // Add mimetype for documents
        if (!img.image_src) {
            this.media.dataset.mimetype = img.mimetype;
        }
        this.$media.trigger('image_changed');
        return this.media;
    }
});

MediaDialog.include({
    /**
     * @param {Object} media
     * @param {Object} options
     * @returns
     */
    getDocumentWidget: function (media, options) {
        return new CustomDocumentWidget(this, media, options);
    }
});

Wysiwyg.include({
    /**
     * @returns {Array[Object]}
     */
    _getCommands: function () {
        const commands = this._super();
        commands.push({
            groupName: 'Medias',
            title: 'File',
            description: 'Embed a file.',
            fontawesome: 'fa-file',
            callback: () => {
                this.openMediaDialog({
                    noVideos: true,
                    noImages: true,
                    noIcons: true,
                    noDocuments: false
                });
            }
        });
        return commands;
    }
});

DialogLinkWidget.include({
    template: 'knowledge.file_modal',
    /**
     * @override
     */
    start: function () {
        return this._super.apply(this, arguments).then(() => {
            const $input = this._getInputSelector();
            $input.select2({
                ajax: {
                    url: '/knowledge/get_articles',
                    dataType: 'json',
                    /**
                     * @param {String} term
                     * @returns {Object}
                     */
                    data: term => {
                        return { query: term, limit: 30 };
                    },
                    /**
                     * @param {Array[Object]} records
                     * @returns {Object}
                     */
                    results: records => {
                        return {
                            results: records.map(record => {
                                return {
                                    id: record.id,
                                    icon: record.icon,
                                    text: record.name,
                                };
                            })
                        };
                    }
                },
                /**
                 * When the user enters a search term, the function will
                 * highlight the part of the string matching with the
                 * search term. (e.g: when the user types 'hello', the
                 * string 'hello world' will be formatted as '<u>hello</u> world').
                 * That way, the user can figure out why a search result appears.
                 * @param {Object} result
                 * @param {integer} result.id
                 * @param {String} result.icon
                 * @param {String} result.text
                 * @returns {String}
                 */
                formatResult: (result, _target, { term }) => {
                    const { icon, text } = result;
                    const pattern = new RegExp(`(${term})`, 'gi');
                    return `<span class="fa ${icon}"></span> ` + (
                        term.length > 0 ? text.replaceAll(pattern, '<u>$1</u>') : text
                    );
                },
            });
            if (this.data.url) {
                this._preselectArticle();
                this._adaptPreview();
            }
            this.$el.find('a[data-toggle="tab"]').on('shown.bs.tab', () => {
                // FIXME: this._getData is undefined for some reason when we create a new link
                // this._adaptPreview();
            });
        });
    },

    /**
     * @override
     * @returns {String}
     */
    _getLinkContent: function () {
        if (this.$el.find('#custom-url').hasClass('active')) {
            return this._super();
        }
        const $input = this._getInputSelector();
        const { text } = $input.select2('data');
        return text;
    },

    /**
     * @override
     * @returns {String}
     */
    _getLinkURL: function () {
        if (this.$el.find('#custom-url').hasClass('active')) {
            return this._super();
        }
        const $input = this._getInputSelector();
        const { id } = $input.select2('data');
        return `${window.location.origin}/article/${id}`;
    },

    /**
     * @returns {jQuery}
     */
    _getInputSelector: function () {
        return this.$el.find('input[type="hidden"]');
    },

    /**
     * Pre-selects the article
     */
    _preselectArticle: async function () {
        const url = this.data.url.substring(this.data.url.indexOf('#') + 1);
        const params = new URLSearchParams(url);
        const id = params.get('id');
        if (params.get('action') !== 'knowledge.action_show_article' || !id) {
            return;
        }
        const result = await this._rpc({
            route: `/knowledge/get_article/${id}`
        });
        if (result === null) {
            return;
        }
        const $input = this._getInputSelector();
        $input.select2('data', {
            id: result.id,
            icon: result.icon,
            text: result.name
        });
    },
});
});
