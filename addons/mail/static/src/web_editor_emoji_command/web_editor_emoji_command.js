/** @odoo-module */

import { _t } from 'web.core';
import Wysiwyg from 'web_editor.wysiwyg';
import { getRangePosition } from '@web_editor/js/editor/odoo-editor/src/utils/utils';

Wysiwyg.include({
    async willStart() {
        const _super = this._super.bind(this);
        if (!owl.Component.env.services.messaging) {
            return _super(...arguments);
        }
        try {
            this.messaging = await this.call('messaging', 'get');
        } catch (_error) {
            if (!this.messaging) {
                return _super(...arguments);
            }
        }
        if (!this.messaging || !this.messaging.messagingBus) {
            return _super(...arguments);
        }
        this.messaging.messagingBus.addEventListener('add_emoji', this._onAddEmoji.bind(this));
        return _super(...arguments);
    },
    destroy() {
        if (!this.messaging || !this.messaging.messagingBus) {
            return;
        }
        this.messaging.messagingBus.removeEventListener('add_emoji', this._onAddEmoji.bind(this));
    },
    _onAddEmoji(ev) {
        this.odooEditor.historyResetLatestComputedSelection();
        this.odooEditor.execCommand('insert', ev.detail.emoji);
    },
    /**
     * @override
     */
    _getPowerboxOptions: function () {
        const options = this._super();
        if (!this.messaging || !this.messaging.messagingBus) {
            return options;
        }
        options.categories.push({
            name: _t('Mail'),
            priority: 300,
        });
        options.commands.push({
            name: _t('Emoji'),
            category: _t('Mail'),
            description: _t("Insert emoji"),
            fontawesome: 'fa-smile-o',
            priority: 1, // This is the only command in its category anyway.
            callback: () => {
                const position = getRangePosition(this.el, document);
                const anchor = document.createElement("div");
                anchor.setAttribute('class', 'web-editor-emoji-picker');
                anchor.setAttribute('style', `position: absolute; top:${position.top}px; left: ${position.left}px`);
                document.body.append(anchor);
                setTimeout(() => {
                    this.messaging.update({ emojiPicker: {} });
                });
            }
        });
        return options;
    },
});
