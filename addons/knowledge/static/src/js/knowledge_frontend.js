/** @odoo-module */
'use strict';

import publicWidget from 'web.public.widget';
import KnowledgeTreePanelMixin from './tools/tree_panel_mixin.js'


publicWidget.registry.KnowledgeWidget = publicWidget.Widget.extend(KnowledgeTreePanelMixin, {
    selector: '.o_knowledge_form_view',
    events: {
        'keyup .knowledge_search_bar': '_searchArticles',
        'click .o_article_caret': '_onFold',
        'click .o_favorites_toggle_button': '_toggleFavorite',
    },

    /**
     * @override
     */
    start: async function () {
        await this._super(...arguments);
        const id = this.$el.data('article-id');
        this._renderTree(id, '/knowledge/tree_panel/portal');
    },

    /**
     * @param {Event} event
     */
    _searchArticles: function (event) {
        const $input = $(event.currentTarget);
        const $tree = $('.o_tree');
        const keyword = $input.val().toLowerCase();
        this._traverse($tree, $li => {
            if ($li.text().toLowerCase().indexOf(keyword) >= 0) {
                $li.show();
            } else {
                $li.hide();
            }
        })
    },

    /**
     * Helper function to traverse the article hierarchy (using dfs)
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
     * @param {Event} event
     */
    _toggleFavorite: function (event) {
        const $star = $(event.currentTarget);
        const id = $star.data('article-id');
        return this._rpc({
            model: 'knowledge.article',
            method: 'action_toggle_favorite',
            args: [[id]]
        }).then(result => {
            $star.find('i').toggleClass('fa-star', result).toggleClass('fa-star-o', !result);
            // Add/Remove the article to/from the favorite in the sidebar
            return this._rpc({
                route: '/knowledge/tree_panel/favorites',
                params: {
                    active_article_id: id,
                }
            }).then(template => {
                this.$('.o_favorite_container').replaceWith(template);
                this._setTreeFavoriteListener();
            });
        });
    },
});
