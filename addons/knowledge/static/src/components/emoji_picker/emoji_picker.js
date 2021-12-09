/** @odoo-module **/

import emojis from '@mail/js/emojis';
const { Component, useSubEnv } = owl;

class Emoji extends Component {
    /**
     * @override
     */
    setup () {
        super.setup();
        // Mock the template variables:
        this.className = '';
        this.emojiListView = {
            /**
             * @param {Event} event
             */
            onClickEmoji: event => {
                const $target = $(event.target);
                this.env.onClickEmoji($target.data('unicode'));
            },
        };
    }
}

Emoji.template = 'mail.Emoji';
Emoji.props =  {
    emoji: Object,
    emojiListViewLocalId: String,
};

class EmojiPicker extends Component {
    /**
     * @override
     */
    setup () {
        super.setup();
        // Mock the template variables:
        this.emojis = emojis;
        this.className = '';
        this.emojiListView = {
            localId: '',
        };
        // Set up sub-environment variables:
        useSubEnv({
            onClickEmoji: this.props.onClickEmoji
        });
    }

    /**
     * @param {Event} event
     */
    onRemoveEmoji (event) {
        this.props.onClickEmoji(false);
    }
}

EmojiPicker.template = 'knowledge.EmojiList';
EmojiPicker.props = ['onClickEmoji'];
EmojiPicker.components = { Emoji };

export default EmojiPicker;
