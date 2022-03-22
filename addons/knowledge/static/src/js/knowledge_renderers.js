/** @odoo-module */

import PermissionPanelWidget from './widgets/knowledge_permission_panel.js';
import EmojiPickerWidget from './widgets/knowledge_emoji_picker.js';
import FormRenderer from 'web.FormRenderer';
import localStorage from 'web.local_storage';
import KnowledgeTreePanelMixin from '@knowledge/js/tools/tree_panel_mixin';


const KnowledgeFormRenderer = FormRenderer.extend(KnowledgeTreePanelMixin, {
    className: 'o_knowledge_form_view',
    events: _.extend({}, FormRenderer.prototype.events, {
        'click .o_article_caret': '_onFold',
        'click .o_article_name': '_onOpen',
        'click .o_article_create, .o_section_create': '_onCreate',
        'click .o_knowledge_share_panel': '_preventDropdownClose',
        'click .o_knowledge_more_options_panel': '_preventDropdownClose',
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
            placeholder: 'bg-info',
            tolerance: 'pointer',
            helper: 'clone',
            cursor: 'grabbing',
            cancel: '.readonly',
            start: (event, ui) => {
                this.$el.find('aside').toggleClass('dragging', true);
            },
            /**
             * @param {Event} event
             * @param {Object} ui
             */
            stop: (event, ui) => {
                $sortable.sortable('disable');
                this.$el.find('aside').toggleClass('dragging', false);

                const $li = $(ui.item);
                const $section = $li.closest('section');
                const $parent = $li.parentsUntil('.o_tree', 'li');

                const data = {
                    article_id: $li.data('article-id'),
                    oldCategory: $li.data('category'),
                    newCategory: $section.data('section')
                };

                if ($parent.length > 0) {
                    data.target_parent_id = $parent.data('article-id');
                }
                const $next = $li.next();
                if ($next.length > 0) {
                    data.before_article_id = $next.data('article-id');
                }

                this.trigger_up('move', {...data,
                    onSuccess: () => {
                        $li.data('category', data.newCategory);
                        $sortable.sortable('enable');
                    },
                    onReject: () => {
                        $sortable.sortable('cancel');
                        $sortable.sortable('enable');
                    }
                });
            },
        });

        // Allow drag and drop between sections:

        const selectors = [
            'section[data-section="workspace"] .o_tree',
            'section[data-section="shared"] .o_tree',
            'section[data-section="private"] .o_tree'
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
     * @param {Event} event
     */
    _onCreate: function (event) {
        const $target = $(event.currentTarget);
        if ($target.hasClass('o_section_create')) {
            const $section = $target.closest('.o_section');
            this.trigger_up('create', {
                category: $section.data('section')
            });
        } else if ($target.hasClass('o_article_create')) {
            const $li = $target.closest('li');
            this.trigger_up('create', {
                target_parent_id: $li.data('article-id')
            });
        }
    },

    /**
     * Opens the selected record.
     * @param {Event} event
     */
    _onOpen: async function (event) {
        event.stopPropagation();
        const $li = $(event.target).closest('li');
        this.do_action('knowledge.action_home_page', {
            stackPosition: 'replaceCurrentAction',
            additional_context: {
                res_id: $li.data('article-id')
            }
        });
    },

    /**
     * @override
     * @returns {Promise}
     */
    _renderView: async function () {
        const result = await this._super.apply(this, arguments);
        this._renderBreadcrumb();
        await this._renderTree(this.state.res_id, '/knowledge/tree_panel/all');
        this._renderPermissionPanel();
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

    /**
     * Renders the emoji picker
     */
    _renderEmojiPicker: function () {
        this.$el.find('.o_article_dropdown').one('click', event => {
            const $dropdown = $(event.currentTarget);
            const $article = $dropdown.closest('.o_article');
            const $picker = new EmojiPickerWidget(this, {
                article_id: $article.data('article-id')
            });
            $picker.attachTo($dropdown);
        });
    },

    /**
     * Renders the permission panel
     */
    _renderPermissionPanel: function () {
        this.$el.find('.btn-share').one('click', event => {
            const $container = this.$el.find('.o_knowledge_permission_panel');
            const panel = new PermissionPanelWidget(this, {
                article_id: this.state.data.id,
                user_permission: this.state.data.user_permission
            });
            panel.attachTo($container);
        });
    },

    /**
     * Enables the user to resize the aside block.
     * Note: When the user grabs the resizer, a new listener will be attached
     * to the document. The listener will be removed as soon as the user releases
     * the resizer to free some resources.
     */
    _setResizeListener: function () {
        /**
         * @param {PointerEvent} event
         */
        const onPointerMove = _.throttle(event => {
            event.preventDefault();
            this.el.style.setProperty('--default-sidebar-size', `${event.pageX}px`);
        }, 100);
        /**
         * @param {PointerEvent} event
         */
        const onPointerUp = event => {
            $(document).off('pointermove', onPointerMove);
        };
        const $resizer = this.$el.find('.o_knowledge_resizer');
        $resizer.on('pointerdown', event => {
            event.preventDefault();
            $(document).on('pointermove', onPointerMove);
            $(document).one('pointerup', onPointerUp);
        });
    },

    /**
     * @param {integer} id - Article id
     * @param {String} unicode
     */
    _setEmoji: function (id, unicode) {
        const emojis = this.$el.find(`.o_article_emoji_dropdown[data-article-id="${id}"] > .o_article_emoji`);
        emojis.text(unicode || '📄');
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
     * By default, Bootstrap closes automatically the dropdown menu when the user
     * clicks inside it. To avoid that behavior, we will add a new event listener
     * on the dropdown menu that will prevent the click event from bubbling up and
     * triggering the listener closing the dropdown menu.
     * @param {Event} event
     */
    _preventDropdownClose: function (event) {
        event.stopPropagation();
    },
});

export {
    KnowledgeFormRenderer,
};
