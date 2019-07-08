odoo.define('mail.component.ComposerTextInput', function (require) {
'use strict';

const ajax = require('web.ajax');
const utils = require('web.utils');

const { Component } = owl;

/**
 * ComposerInput relies on a minimal HTML editor in order to support mentions.
 */
class ComposerInput extends Component {
    /**
     * @param {...any} args
     */
    constructor(...args) {
        super(...args);

        this.MENTION_THROTTLE = 200;
        this.template = 'mail.component.ComposerTextInput';
        this._editable = undefined;
        this._summernoteContext = undefined;
        this._tribute = undefined; // list of tribute mentions (partner, canned responses, etc.)

        this._searchChannelMentionSuggestions = _.throttle(
            this._searchChannelMentionSuggestions.bind(this),
            this.MENTION_THROTTLE
        );
        this._searchPartnerMentionSuggestions = _.throttle(
            this._searchPartnerMentionSuggestions.bind(this),
            this.MENTION_THROTTLE
        );
    }

    willStart() {
        return ajax.loadLibs({
            jsLibs: [
                '/mail/static/lib/tribute/tribute.js',
                '/web_editor/static/lib/summernote/summernote.js'
            ],
            cssLibs: [
                '/web_editor/static/lib/summernote/summernote.css'
            ],
        });
    }

    mounted() {
        const {
            editable,
            editablePlaceholder,
            summernoteContext,
        } = this._configSummernote();
        const tribute = this._configTribute({ editable });

        this._editable = editable;
        this._editablePlaceholder = editablePlaceholder;
        this._summernoteContext = summernoteContext;
        this._tribute = tribute;

        this._clearValue(); // remove initial <p></br></p>
    }

    willUnmount() {
        this._summernoteContext.destroy();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    focus() {
        this._editable.focus();
    }

    focusout() {
        this._editable.blur();
    }

    /**
     * @return {string}
     */
    getValue() {
        return this._editable.innerHTML;
    }

    /**
     * @param {string} content
     */
    insert(content) {
        if (this._summernoteContext.modules.editor.lastRange.sc.nodeType === 3) {
            /**
             * Restore range only if it makes sense, i.e. it targets a text node.
             * This is not the case right after mentioning, in which the cursor
             * position is buggy. Summernote fallbacks by inserting content as
             * child of editor's container, which is very bad... This instead
             * insert text at the default position, which is the beginning of
             * the editor.
             */
            this._summernoteContext.invoke('editor.restoreRange');
        }
        this._summernoteContext.invoke('editor.insertText', content);
    }

    resetValue() {
        this._editable.innerHTML = "";
        this._editablePlaceholder.style['display'] = 'block';
    }

    saveRange() {
        this._summernoteContext.invoke('editor.saveRange');
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _clearValue() {
        if (this._editable.textContent.length === 0) {
            this.resetValue();
        } else {
            // placeholder is a bit slow, this makes it update faster
            this._editablePlaceholder.style['display'] = 'none';
        }
    }

    /**
     * @private
     * @return {Object}
     */
    _configSummernote() {
        const $textarea = $(this.refs.textarea);

        $textarea.summernote({
            callbacks: {
                onPaste(ev) {
                    const bufferText = ((ev.originalEvent || ev).clipboardData ||
                        window.clipboardData).getData('Text');
                    ev.preventDefault();
                    document.execCommand('insertText', false, bufferText);
                },
            },
            disableDragAndDrop: true,
            disableResizeEditor: true,
            placeholder: this.env._t("Write something..."),
            shortcuts: false,
            toolbar: false,
        });

        const editingArea = this.el.querySelector(':scope > .note-editor > .note-editing-area');
        const editable = editingArea.querySelector(':scope .note-editable');
        const editablePlaceholder = editingArea.querySelector(':scope > .note-placeholder');
        const summernoteContext = $textarea.data('summernote');
        summernoteContext.invoke('removeModule', 'autoLink'); // conflict with this summernote module and tribute

        editable.addEventListener('input', ev => this._onInputEditable(ev));
        editable.addEventListener('keydown', ev => this._onKeydownEditable(ev));

        return {
            editable,
            editablePlaceholder,
            summernoteContext,
        };
    }

    /**
     * @private
     * @param {Object} param0
     * @param {HTMLElement} param0.editable
     * @return {Object} tribute object
     */
    _configTribute({ editable }) {
        const tribute = new window.Tribute({
            collection: [
                this._configTributeCollectionItemChannel(),
                this._configTributeCollectionItemPartner(),
                this._configTributeCollectionItemCannedResponse(),
                this._configTributeCollectionItemCommand(),
            ],
        });

        tribute.attach(editable);
        return tribute;
    }

    /**
     * @private
     * @return {Object}
     */
    _configTributeCollectionItemChannel() {
        const self = this;
        const collectionItem = {
            lookup: 'name',
            menuItemTemplate(item) {
                return `<div class="o_ComposerTextInput_mentionItem">${item.string}</div>`;
            },
            selectTemplate(item) {
                if (!item) {
                    // no match keeps mentioning state, hence handle no item selection
                    return null;
                }
                /**
                 * Attributes 'data-oe-id' and 'data-oe-model' are considered
                 * safe by html_sanitizer.
                 */
                return `<span class="o_mention"
                              contenteditable="false"
                              data-oe-id="${item.original.id}"
                              data-oe-model="mail.channel">#${item.original.name}</span>`;
            },
            trigger: '#',
            values(keyword, callback) {
                self._searchChannelMentionSuggestions(keyword, channels => callback(channels));
            },
        };

        return collectionItem;
    }

    /**
     * @private
     * @return {Object}
     */
    _configTributeCollectionItemPartner() {
        const self = this;
        const collectionItem = {
            lookup: 'name',
            menuItemTemplate(item) {
                return `<div class="o_ComposerTextInput_mention"
                             title="${
                                 item.original.name
                             }${
                                 item.original.email
                                    ? `<${item.original.email}>`
                                    : ''
                             }">${
                    item.original.name
                }${
                    item.original.email
                        ? ` <span class="o_extra">${_.str.escapeHTML(`<${item.original.email}>`)}</span>`
                        : ''
                }</div>`;
            },
            selectTemplate(item) {
                if (!item) {
                    // no match may keep mentioning state, hence handle no item selection
                    return null;
                }
                /**
                 * Attributes 'data-oe-id' and 'data-oe-model' are considered
                 * safe by html_sanitizer.
                 */
                return `<span class="o_mention"
                              contenteditable="false"
                              data-oe-id="${item.original.id}"
                              data-oe-model="res.partner">@${item.original.name}</span>`;
            },
            trigger: '@',
            values(keyword, callback) {
                self._searchPartnerMentionSuggestions(keyword, partners => {
                    callback(partners);
                });
            },
        };

        return collectionItem;
    }

    /**
     * @private
     * @return {Object}
     */
    _configTributeCollectionItemCannedResponse() {
        const self = this;
        const collectionItem = {
            lookup: 'source',
            menuItemTemplate(item) {
                return `<div class="o_ComposerTextInput_mention" title="${item.original.source}">
                    ${
                        item.original.source
                    }${
                        ` <span class="o_extra">${item.original.substitution}</span>`
                    }</div>`;
            },
            selectTemplate(item) {
                return item ? item.original.substitution : null;
            },
            trigger: ':',
            values(keyword, callback) {
                const cannedResponses = self._searchCannedResponseSuggestions(keyword);
                callback(cannedResponses);
            },
        };
        return collectionItem;
    }

    /**
     * @private
     * @return {Object}
     */
    _configTributeCollectionItemCommand() {
        const self = this;
        const collectionItem = {
            lookup: 'name',
            menuItemTemplate(item) {
                return `<div class="o_ComposerTextInput_mention" title="${item.original.name}">
                    ${
                    item.original.name
                    }${
                    ` <span class="o_extra">${item.original.help}</span>`
                    }</div>`;
            },
            selectTemplate(item) {
                return `<span class="o_command"
                              contenteditable="false">/${item.original.name}</span>`;
            },
            trigger: '/',
            values(keyword, callback) {
                const commands = self._searchCommandSuggestions(keyword);
                callback(commands);
            },
        };
        return collectionItem;
    }

    /**
     * @private
     * @param {string} keyword
     * @param {function} callback
     */
    async _searchChannelMentionSuggestions(keyword, callback) {
        const suggestions = await this.env.rpc({
            model: 'mail.channel',
            method: 'get_mention_suggestions',
            kwargs: {
                limit: 10,
                search: keyword,
            },
        });
        callback(suggestions);
    }

    /**
     * @private
     * @param {string} keyword
     * @return {Object[]}
     */
    _searchCommandSuggestions(keyword) {
        const commandList = Object.values(this.env.store.state.commands);
        var matches = fuzzy.filter(
            utils.unaccent(keyword),
            commandList.map(command => command.name));
        return matches.slice(0, 10).map(match => commandList[match.index]);
    }

    /**
     * @private
     * @param {string} keyword
     * @param {function} callback
     */
    async _searchPartnerMentionSuggestions(keyword, callback) {
        const suggestions = await this.env.rpc({
            model: 'res.partner',
            method: 'get_mention_suggestions',
            kwargs: {
                limit: 10,
                search: keyword,
            },
        });
        callback(suggestions);
    }

    /**
     * @private
     * @param {string} keyword
     * @returns {Object[]}
     */
    _searchCannedResponseSuggestions(keyword) {
        const cannedResponseList = Object.values(this.env.store.state.cannedResponses);
        var matches = fuzzy.filter(
            utils.unaccent(keyword),
            cannedResponseList.map(cannedResponse => cannedResponse.source));
        return matches.slice(0, 10).map(match => cannedResponseList[match.index]);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {KeyboardEvent} ev
     */
    _onInputEditable(ev) {
        this._clearValue();
    }

    /**
     * @private
     * @param {KeyboardEvent} ev
     */
    _onKeydownEditable(ev) {
        switch (ev.key) {
            case 'Backspace':
                this._onKeydownEditableBackspace(ev);
                break;
            case 'Enter':
                this._onKeydownEditableEnter(ev);
                break;
            default:
                break;
        }
    }

    /**
     * Force deleting contenteditable = 'false' inside editable.
     * It works by default on Chrome and Safari works fine, but not on Firefox
     * due to following bug:
     * https://bugzilla.mozilla.org/show_bug.cgi?id=685452
     *
     * Adapted code from:
     * https://stackoverflow.com/questions/2177958/how-to-delete-an-html-element-inside-a-div-with-attribute-contenteditable/30574622#30574622
     *
     * @private
     * @param {KeyboardEvent} ev
     */
    _onKeydownEditableBackspace(ev) {
        if (this.getValue().length === 0) {
            return;
        }
        const selection = window.getSelection();
        if (!selection.isCollapsed || !selection.rangeCount) {
            return;
        }
        const curRange = selection.getRangeAt(selection.rangeCount - 1);
        if (curRange.commonAncestorContainer.nodeType === 3 && curRange.startOffset > 0) {
            // we are in child selection. The characters of the text node is being deleted
            return;
        }

        const range = document.createRange();
        if (selection.anchorNode !== ev.target) {
            // selection is in character mode. expand it to the whole editable field
            range.selectNodeContents(ev.target);
            range.setEndBefore(selection.anchorNode);
        } else if (selection.anchorOffset > 0) {
            range.setEnd(ev.target, selection.anchorOffset);
        } else {
            // reached the beginning of editable field
            return;
        }
        try {
            range.setStart(ev.target, range.endOffset - 2);
        } catch {
            return;
        }
        const previousNode = range.cloneContents().lastChild;
        if (previousNode) {
            if (previousNode.contentEditable === 'false') {
                range.deleteContents();
                ev.preventDefault();
            }
            /**
             * Prevent cursor bug in Firefox with contenteditable='false'
             * inside contenteditable='true', by having more aggressive delete
             * behaviour:
             * https://bugzilla.mozilla.org/show_bug.cgi?id=685452
             */
            const formerPreviousNode = previousNode.previousSibling;
            if (formerPreviousNode && formerPreviousNode.contentEditable === 'false') {
                range.deleteContents();
                ev.preventDefault();
            }
        }
        this._clearValue();
    }

    /**
     * @private
     * @param {KeyboardEvent} ev
     */
    _onKeydownEditableEnter(ev) {
        if (this._tribute.isActive) {
            return;
        }
        if (ev.shiftKey) {
            return;
        }
        if (this._editable.innerHTML.length === 0) {
            return;
        }
        this.trigger('post-message');
        ev.preventDefault();
    }
}

return ComposerInput;

});
