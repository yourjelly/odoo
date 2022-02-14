/** @odoo-module */

import EmojiPickerWidget from './widgets/knowledge_emoji_picker.js';
import FormRenderer from 'web.FormRenderer';
import { qweb as QWeb } from 'web.core';

const KnowledgeFormRenderer = FormRenderer.extend({
    className: 'o_knowledge_form_view',
    events: _.extend({}, FormRenderer.prototype.events, {
        'click .o_article_caret': '_onFold',
        'click .o_article_dropdown i': '_onIconClick',
        'click .o_article_create': '_onArticleCreate',
    }),

    /**
     * @override
     */
    init: function (parent, state, params) {
        this._super(...arguments);
        this.breadcrumbs = params.breadcrumbs;
    },

    _setTreeListener: function () {
        const $sortable = this.$el.find('.o_tree');
        $sortable.nestedSortable({
            axis: 'y',
            handle: 'div',
            items: 'li',
            listType: 'ul',
            toleranceElement: '> div',
            forcePlaceholderSize: true,
            opacity: 0.6,
            placeholder: 'o_placeholder',
            tolerance: 'pointer',
            helper: 'clone',
            cursor: 'grabbing',
            start: (event, ui) => {
                this.$el.find('aside').toggleClass('dragging', true);
            },
            /**
             * @param {Event} event
             * @param {Object} ui
             */
            stop: (event, ui) => {
                $sortable.sortable('disable');
                const $li = $(ui.item);
                const data = { article_id: $li.data('article-id') };
                const $parent = $li.parentsUntil('.o_tree', 'li');

                if ($parent.length === 0) {
                    const $tree = $li.closest('.o_tree');
                    data.target_parent_id = $tree.data('section');
                } else {
                    data.target_parent_id = $parent.data('article-id');
                    const $next = $li.next();
                    if ($next.length !== 0) {
                        data.before_article_id = $next.data('article-id');
                    }
                }

                this.trigger_up('move', {...data,
                    onSuccess: () => {
                        $sortable.sortable('enable');
                    },
                    onReject: () => {
                        $sortable.sortable('cancel');
                        $sortable.sortable('enable');
                    }
                });
                this.$el.find('aside').toggleClass('dragging', false);
            },
        });

        // Allow drag and drop between sections:

        const selectors = [
            '.o_tree[data-section="workspace"]',
            '.o_tree[data-section="shared"]',
            '.o_tree[data-section="private"]'
        ];

        selectors.forEach(selector => {
            // Note: An element can be connected to one selector at most.
            this.$el.find(selector).nestedSortable(
                'option',
                'connectWith',
                `.o_tree:not(${selector})`
            );
        });
    },

    /**
     * When the user clicks on the caret to hide and show some files
     * @param {Event} event
     */
    _onFold: function (event) {
        event.stopPropagation();
        const $button = $(event.currentTarget);
        const $icon = $button.find('i');
        const $li = $button.closest('li');
        const $ul = $li.find('ul');
        if ($ul.length !== 0) {
            $ul.toggle();
            if ($ul.is(':visible')) {
                $icon.removeClass('fa-caret-right');
                $icon.addClass('fa-caret-down');
            } else {
                $icon.removeClass('fa-caret-down');
                $icon.addClass('fa-caret-right');
            }
        }
    },

    _onArticleCreate: function () {
        console.log('Creating an article');
    },

    /**
     * Refresh the icons
     * @param {jQuery} $tree
     */
    _refreshIcons: function ($tree) {
        this._traverse($tree, $li => {
            if ($li.has('ol').length > 0) {
                // todo
            } else {
                // todo
            }
        });
    },

    /**
     * @override
     * @returns {Promise}
     */
    _renderView: async function () {
        const { data } = this.state
        if (Object.keys(data).length === 1) {
            const $error = $(QWeb.render('knowledge.knowledge_article_not_found'));
            this._updateView($error.contents());
            return Promise.resolve();
        }
        const result = await this._super.apply(this, arguments);
        this._renderBreadcrumb();
        this._renderEmojiPicker();
        this._setTreeListener();
        this._setResizeListener();
        return result;
    },

    _renderBreadcrumb: function () {
        const items = this.breadcrumbs.map(payload => {
            const $a = $('<a href="#"/>');
            $a.text(payload.title);
            $a.click(() => {
                this.trigger_up('breadcrumb_clicked', payload);
            });
            const $li = $('<li class="breadcrumb-item"/>');
            $li.append($a);
            return $li;
        });
        const $container = this.$el.find('.breadcrumb');
        $container.prepend(items);
    },

    _renderEmojiPicker: function () {
        this.$el.find('.o_article_dropdown').each((_index, $dropdown) => {
            const $picker = new EmojiPickerWidget(this, {});
            $picker.attachTo($dropdown);
        });
    },

    _setResizeListener: function () {
        /**
         * @param {PointerEvent} event
         */
        const onPointerMove = event => {
            event.preventDefault();
            this.el.style.setProperty('--default-sidebar-size', `${event.pageX}px`);
        };
        /**
         * @param {PointerEvent} event
         */
        const onPointerUp = event => {
            $(document).off('pointermove', onPointerMove);
        };
        const $resizer = this.$el.find('.o_knowledge_resizer');
        $resizer.on('pointerdown', _.throttle(event => {
            event.preventDefault();
            $(document).on('pointermove', onPointerMove);
            $(document).one('pointerup', onPointerUp);
        }, 100));
    },

    /**
     * Helper function to traverses the nested list (dfs)
     * @param {jQuery} $tree
     * @param {Function} callback
     */
    _traverse: function ($tree, callback) {
        const stack = $tree.children('li').toArray();
        while (stack.length > 0) {
            const $li = $(stack.shift());
            const $ul = $li.children('ul');
            callback($li);
            if ($ul.length > 0) {
                stack.unshift(...$ul.children('li').toArray());
            }
        }
    },

    /**
     * Moves the article under another article or section
     * @param {integer} article_id
     * @param {(integer|String)} target_parent_id
     */
    moveArticleUnder: function (article_id, target_parent_id) {
        const $li = this.$el.find(`.o_tree [data-article-id="${article_id}"]`);
        if (['workspace', 'private', 'shared'].includes(target_parent_id)) {
            const $tree = this.$el.find(`.o_tree[data-section="${target_parent_id}"]`);
            $tree.append($li);
            return;
        }
        const $parent = this.$el.find(`.o_tree [data-article-id="${target_parent_id}"]`);
        if ($parent.length !== 0) {
            let $ul = $parent.find('ul:first');
            if ($ul.length === 0) {
                $ul = $('<ul>');
                $parent.append($ul);
            }
            $ul.append($li);
        }
    },
});

export {
    KnowledgeFormRenderer,
};
