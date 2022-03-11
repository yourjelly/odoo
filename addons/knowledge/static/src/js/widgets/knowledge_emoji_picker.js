/** @odoo-module **/

import Widget from 'web.Widget';
import { ComponentWrapper, WidgetAdapterMixin } from 'web.OwlCompatibility';
import EmojiPicker from '@mail/components/emoji_picker/emoji_picker';

const EmojiPickerWidget = Widget.extend(WidgetAdapterMixin, {
    events: {
        'click': '_onOpen',
        'click .dropdown-menu': '_onClick'
    },

    /**
     * @override
     * @param {Object} parent
     * @param {Object} options
     */
    init: function (parent, options) {
        this._super(...arguments);
        this.options = options;
    },

    /**
     * @override
     */
    start: function () {
        this.component = new ComponentWrapper(this, EmojiPicker, {
            /**
             * @param {String} unicode
             */
            onEmojiClick: unicode => {
                this.trigger_up('emoji_click', {
                    article_id: this.options.article_id,
                    unicode
                })
            }
        });
    },

    /**
     * @param {Event} event
     */
    _onOpen: function (event) {
        const menu = this.el.querySelector('.dropdown-menu');
        this.component.mount(menu);
    },

    /**
     * @param {Event} event
     */
    _onClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
    },
});

export default EmojiPickerWidget;
