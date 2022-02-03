/* @odoo-module */

import { _t } from 'web.core';
import { FieldMany2One, FormFieldMany2ManyTags } from 'web.relational_fields';
import field_registry from 'web.field_registry';

const ProjectMany2ManyTags = FormFieldMany2ManyTags.extend({
    _getMany2OneWidget() {
        return FieldMany2One.extend({
            /**
             * @override
             */
            init() {
                this._super(...arguments);
                this.searchMoreDomain = [];
            },
            /**
             * @private
             * @override
             */
            _getSearchMoreItem() {
                const searchMoreItem = this._super(...arguments);
                return {
                    ...searchMoreItem,
                    label: _t('Search accross all projects'),
                };
            },
            /**
             * @private
             * @override
             */
            async _search(searchValue = "") {
                const values = await this._super(searchValue);
                const records = values.filter((item) => item.id);
                if (records.length <= this.limit) {
                    values.push(this._getSearchMoreItem(searchValue, this._getSearchDomain(), this._getSearchContext()));
                }
                return values;
            },
        });
    },
});

field_registry.add('form.project_many2many_tags', ProjectMany2ManyTags);

export default {
    ProjectMany2ManyTags,
};
