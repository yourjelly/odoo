/** @odoo-module */

import FormRenderer from 'web.FormRenderer';

const KnowledgeFormRenderer = FormRenderer.extend({
    events: _.extend({}, FormRenderer.prototype.events, {
        'click .fa': '_onDropdown'
    }),

    /**
     * @override
     * @returns {Promise}
     */
    start: function () {
        return this._super.apply(this, arguments).then(() => {
            const aside = this.$el.find('.o_sidebar');
            this._rpc({
                route: '/knowledge/get_tree',
                params: {}
            }).then(res => {
                aside.html(res);
                this.init_sortable();
            }).catch(error => {
                console.log('error', error);
                aside.empty();
            });
        });
    },

    init_sortable: function () {
        this.$el.find('.o_tree').nestedSortable({
            handle: 'div',
            items: 'li',
            listType: 'ul',
            toleranceElement: '> div',
            forcePlaceholderSize: true,
            opacity: 0.6,
            placeholder: 'o_placeholder',
            tolerance: 'pointer',
            relocate: event => {
                const $target = $(event.target);
                const hierarchy = $target.nestedSortable('toHierarchy');
                console.log('Hierarchy', hierarchy);
                this._refreshIcons($target);
            }
        });

        // We set the listeners:

        this.$el.find('.o_tree').on('sortreceive', (event, ui) => {
            console.log('receive event', event, 'ui', ui);
        });

        this.$el.find('.o_tree').on('sortremove', (event, ui) => {
            console.log('remove event', event, 'ui', ui);
        });

        // We connect the trees:

        this.$el.find('.o_tree_workspace .o_tree').nestedSortable(
            'option',
            'connectWith',
            '.o_tree_private .o_tree'
        );

        this.$el.find('.o_tree_private .o_tree').nestedSortable(
            'option',
            'connectWith',
            '.o_tree_workspace .o_tree'
        );
    },

    /**
     * When the user clicks on the caret to hide and show some files
     * @param {Event} event
     */
    _onDropdown: function (event) {
        const $icon = $(event.target);
        const $li = $icon.closest('li');
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

    /**
     * Refresh the icons
     */
    _refreshIcons: function ($tree) {
        this._traverse($tree, ($li) => {
            if ($li.has('ol').length > 0) {
                // todo
            } else {
                // todo
            }
        });
    },

    /**
     * Helper function to traverses the nested list (dfs)
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
});

export {
    KnowledgeFormRenderer,
};
