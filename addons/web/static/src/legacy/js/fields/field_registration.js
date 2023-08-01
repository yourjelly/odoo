/** @odoo-module **/

import AbstractField from "@web/legacy/js/fields/abstract_field";
import relational_fields from "@web/legacy/js/fields/relational_fields";
import registry from "@web/legacy/js/fields/field_registry";

// Relational fields
registry
    .add('many2one', relational_fields.FieldMany2One)
    .add('many2one_avatar', relational_fields.Many2OneAvatar)
    .add('many2many_tags', relational_fields.FieldMany2ManyTags)
    .add('many2many_tags_avatar', relational_fields.FieldMany2ManyTagsAvatar)
    .add('kanban.many2many_tags_avatar', relational_fields.KanbanMany2ManyTagsAvatar)
    .add('list.many2many_tags_avatar', relational_fields.ListMany2ManyTagsAvatar)
    .add('form.many2many_tags', relational_fields.FormFieldMany2ManyTags)
    .add('radio', relational_fields.FieldRadio)
    .add('selection', relational_fields.FieldSelection);
