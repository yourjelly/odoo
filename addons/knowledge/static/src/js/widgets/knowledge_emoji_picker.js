/** @odoo-module **/

import emojis from '@mail/js/emojis';
import Widget from 'web.Widget';
import { qweb as QWeb, _t } from 'web.core';

const EmojiPickerWidget = Widget.extend({
    events: {
        'click': '_onOpen'
    },

    /**
     * @param {Event} event
     */
     _onOpen: function (event) {
        const $panel = $(QWeb.render('knowledge.knowledge_emoji_panel', {
            emojis
        }));
        $panel.find('a').on('click', event => {
            event.stopPropagation();
            event.preventDefault();
        })
        const $input = $panel.find('input');
        $input.on('click', event => {
            event.stopPropagation();
        });
        $input.on('input', event => {
            const value = $input.val();
            $panel.find('.o_emoji').each((_index, $emoji) => {
                // console.log('$emoji', $emoji);
            });
        });
        const $menu = this.$el.find('.dropdown-menu');
        $menu.empty();
        $menu.append($panel);
        // emojis.forEach(emoji => {
        //     const $span = $('<span class="p-1 rounded"/>');
        //     $span.text(emoji.unicode);
        //     $span.on('click', () => {
        //         const $parent = $menu.parentsUntil('.o_tree', 'li');
        //         this.trigger_up('emoji_picked', {
        //             unicode: emoji.unicode,
        //             article_id: $parent.data('article-id')
        //         });
        //     });
        //     $container.append($span);
        // });
    },
});

export default EmojiPickerWidget;
