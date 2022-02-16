/** @odoo-module **/

import emojis from '@mail/js/emojis';
import Widget from 'web.Widget';

const EmojiPickerWidget = Widget.extend({
    events: {
        'click': '_onOpen'
    },

    /**
     * @param {Event} event
     */
     _onOpen: function (event) {
        const $menu = this.$el.find('.dropdown-menu');
        $menu.empty();
        emojis.forEach(emoji => {
            const $span = $('<span class="p-1 rounded"/>');
            $span.text(emoji.unicode);
            $span.on('click', () => {
                const $parent = $menu.parentsUntil('.o_tree', 'li');
                this.trigger_up('emoji_picked', {
                    unicode: emoji.unicode,
                    article_id: $parent.data('article-id')
                });
            });
            $menu.append($span);
        });
    },
});

export default EmojiPickerWidget;
