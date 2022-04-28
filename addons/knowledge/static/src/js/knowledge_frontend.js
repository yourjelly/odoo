odoo.define('knowledge.knowledge_frontend', function (require) {
'use strict';

var publicWidget = require('web.public.widget');
var core = require('web.core');
var QWeb = core.qweb;

var KnowledgeTreePanelMixin = require('@knowledge/js/tools/tree_panel_mixin')[Symbol.for("default")];

publicWidget.registry.KnowledgeWidget = publicWidget.Widget.extend(KnowledgeTreePanelMixin, {
    selector: '.o_knowledge_form_view',
    events: {
        'keyup #knowledge_search': '_searchArticles',
        'click .o_article_caret': '_onFold',
        'click .o_favorites_toggle_button': '_toggleFavourite',
    },

    /**
     * @override
     */
     start: function () {
        return this._super(...arguments).then(async () => {
            const { articleId } = $('.o_knowledge_form_view').data();
            this._renderTree(articleId, '/knowledge/tree_panel/portal');
        });
    },

    _searchArticles: function (e) {
        const $tree = $('.o_tree');
        const search = $('#knowledge_search');
        this._traverse($tree, $li => {
            const keyword = search.val().toLowerCase();
            if ($li.text().toLowerCase().indexOf(keyword) >= 0) {
                $li.show();
            }
            else {
                $li.hide();
            }
        })
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

    _toggleFavourite: async function (e) {
        const toggleWidget = $(e.currentTarget);
        const id = toggleWidget.data('articleId');
        const result = await this._rpc({
            model: 'knowledge.article',
            method: 'action_toggle_favourite',
            args: [[id]]
        });
        toggleWidget.find('i').toggleClass("fa-star", result).toggleClass("fa-star-o", !result);
        // Add/Remove the article to/from the favourite in the sidebar
        this._rpc({
            route: '/knowledge/tree_panel/favorites',
            params: {
                active_article_id: id,
            }

        }).then(favouriteTemplate => {
            this.$(".o_favourite_container").replaceWith(favouriteTemplate);
            this._setTreeFavoriteListener();
        });
    }
});
});
