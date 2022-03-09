/** @odoo-module */

import emojiSections from '@mail/js/emojis_sections'
const { Component, useState, onMounted } = owl;

class EmojiPicker extends Component {
    /**
     * @override
     */
    setup () {
        super.setup();
        this.uid = this.getUniqueID();
        this.sections = this.getEmojiSections();
        this.state = useState({
            term: '',
            sections: this.sections
        });
        onMounted(() => this._mounted());
    }

    /**
     * @returns {String}
     */
    getUniqueID () {
        return _.uniqueId('o_emoji_picker_');
    }

    /**
     * @returns {Object}
     */
    getEmojiSections () {
        return emojiSections;
    }

    /**
     * Callback function called when the user clicks on an emoji.
     * @param {String} unicode
     */
    onEmojiClick (unicode) {
        if (this.props.onEmojiClick) {
            this.props.onEmojiClick(unicode);
        }
    }

    /**
     * Callback function called when the user clicks on a nav item.
     * @param {Event} event
     */
    onNavItemClick (event) {
        event.preventDefault();
        event.stopPropagation();
        const id = $(event.target).attr('href').substring(1);
        const $pane = $(this.el).find('.o_emoji_pane');
        const $title = $pane.find(`[id="${id}"]`);
        if ($title.length === 0) {
            return;
        }
        $pane.animate({
            scrollTop: $title.position().top + $pane.scrollTop()
        });
    }

    /**
     * Callback function called when the user types something on the search box.
     * @param {Event} event
     */
    _onInputChange (event) {
        const term = event.target.value;
        this.state.term = term;
        if (term.length === 0) {
            this.state.sections = this.sections;
            return;
        }
        const sections = [];
        for (const section of this.sections) {
            const emojis = section.emojis.filter(emoji => {
                return emoji[1].some(text => {
                    return text.indexOf(term) >= 0;
                });
            });
            if (emojis.length > 0) {
                sections.push({...section,
                    emojis: emojis
                });
            }
        }
        this.state.sections = sections;
    }

    /**
     * Callback function called when the user clicks on the reset button.
     * @param {Event} event
     */
    _onResetInput (event) {
        this.state.term = '';
        this.state.sections = this.sections;
    }

    /**
     * Callback function called when the component is mounted to the dom.
     */
    _mounted () {
        const $pane = $(this.el).find('.o_emoji_pane');
        $pane.scrollspy();
    }
}

EmojiPicker.template = 'mail.EmojiPicker';
EmojiPicker.props = ['onEmojiClick'];

export default EmojiPicker;
