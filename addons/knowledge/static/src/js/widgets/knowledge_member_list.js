/** @odoo-module **/

import { FieldMany2ManyTags } from 'web.relational_fields';
import fieldRegistry from 'web.field_registry';
import { _lt } from 'web.core';

const MemberListFieldOne2Many = FieldMany2ManyTags.extend({
    description: _lt('Invited users'),
    tag_template: 'knowledge.knowledge_member_list',
    limit: 10,
    isQuickEditable: false,
    fieldsToFetch: {
        display_name: { type: 'char' },
        partner_id: { type: 'integer' },
        permission: { type: 'selection' },
    },
    events: _.extend({}, FieldMany2ManyTags.prototype.events, {
        'change select': '_onUpdatePermission'
    }),

    /**
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        this.className = '';
    },

    /**
     * @override
     */
    _renderEdit: function () {
        this._renderReadonly();
    },

    /**
     * @override
     * @returns {Object}
     */
    _getRenderTagsContext: function () {
        return {
            avatarModel: this.nodeOptions.avatarModel || this.field.relation,
            avatarField: this.nodeOptions.avatarField || 'avatar_128',
            elements: this.value.data.map(record => {
                const { data } = record;
                return {
                    id: data.id,
                    display_name: data.display_name,
                    partner_id: data.partner_id[0],
                    permission: data.permission
                }
            })
        };
    },

    /**
     * @private
     * @param {Event} event
     */
    _onDeleteTag: function (event) {
        event.preventDefault();
        event.stopPropagation();
        const $button = $(event.target);
        const $tag = $button.closest('.o_knowledge_member');
        this._removeTag($tag.data('id'));
    },

    /**
     * @param {Event} event
     */
    _onUpdatePermission: function (event) {
        const $select = $(event.target);
        const $tag = $select.closest('.o_knowledge_member');
        const record = _.findWhere(this.value.data, {
            res_id: $tag.data('id')
        });
        this._setValue({
            operation: 'UPDATE',
            id: record.id,
            data: {
                permission: $select.val()
            },
        });
    },
});

fieldRegistry.add('knowledge_member_list', MemberListFieldOne2Many);
