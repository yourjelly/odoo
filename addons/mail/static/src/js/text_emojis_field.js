odoo.define('mail.text_emojis', function (require) {
"use strict";

var AbstractField = require('web.AbstractField');
var emojis = require('mail.emojis');
var registry = require('web.field_registry');

var FieldTextEmojis = AbstractField.extend({
    template: 'text_emojis_field',

    events: {
        'change': '_onInput',
        'click .o_mail_emoji': '_onEmojiClick',
        'blur': '_computeReadonlyHtml',
    },

    supportedFieldTypes: ['char', 'text'],

    init: function () {
        this._super.apply(this, arguments);
        this.emojis = emojis;
        this.multilines = arguments[2].fields[arguments[1]].type === 'text';
        this._computeReadonlyHtml();
    },

    isSet: function () {
        return !!this.value;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    _onInput: function(event) {
        this._setValue(event.target.value);
    },

    _onEmojiClick: function (event) {
        var unicode = event.target.dataset.emojiUnicode;
        var textInput = this.el.querySelector('.o_mail_emoji_input');
        var selectionStart = textInput.selectionStart;

        textInput.value = this._insertAt(textInput.value, selectionStart, unicode);
        this._setValue(textInput.value);
        textInput.focus();
        textInput.setSelectionRange(selectionStart + unicode.length, selectionStart + unicode.length);
        console.log(unicode);
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _computeReadonlyHtml: function () {
        this.html_value = this._formatText(this.value);
    },

    _formatText: function (message) {
        message = this._htmlEscape(message);

        this.emojis.forEach(function (emoji) {
            message = message.replace(
                new RegExp(emoji.unicode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
                '<span class="o_mail_emoji">' + emoji.unicode + '</span>'
            );
        });

        return message;
    },

    _htmlEscape: function (s) {
        if (s === null) {
            return '';
        }
        return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _insertAt: function (str, position, element) {
        // insert into a string and care about the Unicode characters (!= bytes insertion)
        var strArray = Array.from(str);
        return strArray.slice(0, position).concat([element], strArray.slice(position)).join('');
    },
});

registry.add('text_emojis', FieldTextEmojis);

return FieldTextEmojis;

});
