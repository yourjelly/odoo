/** @odoo-module */

import FormRenderer from 'web.FormRenderer';

const KnowledgeFormRenderer = FormRenderer.extend({
    events: _.extend({}, FormRenderer.prototype.events, {
        'click .fa': '_onDropdown'
    }),

    start: function () {
        return this._super.apply(this, arguments).then(() => {
            this.init_sortable();
        });
    },

    init_sortable: function () {
        const $tree = this.$el.find('.o_tree');
        $tree.nestedSortable({
            handle: 'div',
            items: 'li',
            toleranceElement: '> div',
            forcePlaceholderSize: true,
            opacity: 0.6,
            placeholder: 'o_placeholder',
            tolerance: 'pointer',
            relocate: () => {
                const hierarchy = $tree.nestedSortable('toHierarchy');
                // TODO: Send the new hierarchy to the server or send what changed ?
                console.log('Hierarchy', hierarchy);
                this._refreshIcons();
            }
        });
    },
    /**
     * When the user clicks on the caret to hide and show some files
     * and folder
     * @param {Event} event
     */
    _onDropdown: function (event) {
        const $icon = $(event.target);
        const $li = $icon.closest('li');
        const $ol = $li.find('ol');
        if ($ol.length !== 0) {
            $ol.toggle();
            if ($ol.is(':visible')) {
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
    _refreshIcons: function () {
        this._traverse(($li) => {
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
    _traverse: function (callback) {
        const $tree = this.$el.find('.o_tree');
        const stack = $tree.children('li').toArray();
        while (stack.length > 0) {
            const $li = $(stack.shift());
            const $ol = $li.children('ol');
            callback($li);
            if ($ol.length > 0) {
                stack.unshift(...$ol.children('li').toArray())
            }
        }
    },
});

export {
    KnowledgeFormRenderer,
};
