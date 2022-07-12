 odoo.define('sale_product_configurator.SelectionTagMixin', function (require) {
'use strict';

const core = require('web.core');

const _t = core._t;

const SelectionTagMixin = {

    /**
     * Handler for select2 on tags added to the proposal track form.
     *
     * @private
     */
    _bindSelect2Dropdown() {
        const self = this;
        if (this.$('.o_wetrack_select2_tags').length) {
            this.$('.o_wetrack_select2_tags').select2(this._select2Wrapper(_t('Select categories')));
        }
    },
    /**
     *
     * @private
     */
    _select2Wrapper(tag) {
        var nameKey = nameKey || 'name';

        var values = {
            placeholder: tag,
            allowClear: true,
            formatNoMatches: _t('No results found'),
            selection_data: false,
            multiple: 'multiple',
            sorter: data => data.sort((a, b) => a.text.localeCompare(b.text)),
            fill_data: function (query, data) {
                var that = this,
                    tags = {results: []};
                _.each(data, function (obj) {
                    if (that.matcher(query.term, obj[nameKey]) || that.matcher(query.term, obj.category_id[1])) {
                        if (obj.category_id[1]) {
                            tags.results.push({id: obj.id, text: obj[nameKey]});
                        } else {
                            tags.results.push({id: obj.id, text: obj[nameKey]});
                        }
                    }
                });
                query.callback(tags);
            },

            query(query) {
                const that = this;
                if (!this.selection_data) {
                    const data = [{'id': 1, 'name': 'Consumers', 'category_id': (1, 'Audience')}, {'id': 2, 'name': 'Sales', 'category_id': (1, 'Audience')}, {'id': 3, 'name': 'Research', 'category_id': (1, 'Audience')}, {'id': 4, 'name': 'Lightning Talks', 'category_id': (2, 'Format')}, {'id': 5, 'name': 'Round Table', 'category_id': (2, 'Format')}, {'id': 6, 'name': 'Keynote', 'category_id': (2, 'Format')}]
                    that.fill_data(query, data);
                    that.selection_data = data;
                } else {
                    this.fill_data(query, this.selection_data);
                }
            }
        };
        return values;
    },
}

return SelectionTagMixin;

});