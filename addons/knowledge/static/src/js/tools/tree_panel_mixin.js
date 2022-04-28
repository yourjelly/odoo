/** @odoo-module **/

export default {
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _renderTree: async function (active_article_id, route) {
        const $container = this.$el.find('.o_knowledge_tree');
        const readonlyMode = $container.data('readonlyMode');
        let unfoldedArticles = localStorage.getItem('unfoldedArticles');
        unfoldedArticles = unfoldedArticles ? unfoldedArticles.split(";").map(Number) : false;
        return this._rpc({
            route: route,
            params: {
                active_article_id: active_article_id,
                unfolded_articles: unfoldedArticles,
            }
        }).then(res => {
            $container.empty();
            $container.append(res.template);
            if (!readonlyMode) {
                this._setTreeListener();
                this._renderEmojiPicker();
            }
            this._setTreeFavoriteListener();
            // Update unfoldedArticles with active article and all its parents.
            localStorage.setItem('unfoldedArticles', res.unfolded_articles.join(";"));
        }).catch(error => {
            $container.empty();
        });
    },

    _setTreeFavoriteListener () {
        const $sortable = this.$el.find('.o_tree_favourite');
        $sortable.sortable({
            axis: 'y',
            items: 'li',
            cursor: 'grabbing',
            forcePlaceholderSize: true,
            placeholder: 'o_placeholder',
            /**
             * @param {Event} event
             * @param {Object} ui
             */
            stop: (event, ui) => {
                const $li = $(ui.item);
                const data = {
                    article_id: $li.data('article-id'),
                };
                const $next = $li.next();
                if ($next.length > 0) {
                    data.sequence = $next.data('favourite-sequence') || 0;
                }
                $sortable.sortable('disable');
                this._rpc({
                    model: 'knowledge.article.favourite',
                    method: 'set_sequence',
                    args: [[]],
                    kwargs: data,
                }).then(() => {
                    $sortable.sortable('enable');
                }).catch(() => {
                    $sortable.sortable('cancel');
                    $sortable.sortable('enable');
                });
            },
        });
    },

    /**
     * When the user clicks on the caret to hide and show some files
     * @param {Event} event
     */
    _onFold: async function (event) {
        event.stopPropagation();
        const $button = $(event.currentTarget);
        const $icon = $button.find('i');
        const $li = $button.closest('li');
        const $ul = $li.find('ul');
        let unfoldedArticles = localStorage.getItem('unfoldedArticles');
        unfoldedArticles = unfoldedArticles ? unfoldedArticles.split(";") : [];
        const articleId = $li.data('articleId').toString();
        if ($ul.is(':visible')) {
            if (unfoldedArticles.indexOf(articleId) !== -1) {
                unfoldedArticles.splice(unfoldedArticles.indexOf(articleId), 1);
            }
            $icon.removeClass('fa-caret-down');
            $icon.addClass('fa-caret-right');
        } else {
            if ($ul.length === 0) {
                // Call the children content
                const children = await this._rpc({
                    route: '/knowledge/tree_panel/children',
                    params: {
                        parent_id: $li.data('articleId')
                    }
                });
                $li.append($('<ul/>').append(children));
            }
            if (unfoldedArticles.indexOf(articleId) === -1) {
                unfoldedArticles.push(articleId);
            }
            $icon.removeClass('fa-caret-right');
            $icon.addClass('fa-caret-down');
        }
        $ul.toggle();
        localStorage.setItem('unfoldedArticles', unfoldedArticles.join(";"));
    }
};

