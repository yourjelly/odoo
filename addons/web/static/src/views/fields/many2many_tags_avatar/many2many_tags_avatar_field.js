/** @odoo-module **/

import { Component } from "@odoo/owl";
import { usePopover } from "@web/core/popover/popover_hook";
import { registry } from "@web/core/registry";
import { Many2ManyTagsField } from "@web/views/fields/many2many_tags/many2many_tags_field";
import { Many2XAutocomplete } from "@web/views/fields/relational_utils";
import { TagsList } from "../many2many_tags/tags_list";

export class Many2ManyTagsAvatarField extends Many2ManyTagsField {
    get tags() {
        return super.tags.map((tag) => ({
            ...tag,
            img: `/web/image/${this.props.relation}/${tag.resId}/avatar_128`,
            onDelete: !this.props.readonly ? () => this.deleteTag(tag.id) : undefined,
        }));
    }
}

Many2ManyTagsAvatarField.template = "web.Many2ManyTagsAvatarField";
Many2ManyTagsAvatarField.components = {
    Many2XAutocomplete,
    TagsList,
};

registry.category("fields").add("many2many_tags_avatar", Many2ManyTagsAvatarField);

export class PopoverComponent extends Component {}
PopoverComponent.template = "web.Many2ManyTagsAvatarPopover";
PopoverComponent.components = { Many2XAutocomplete };

export class ListKanbanMany2ManyTagsAvatarField extends Many2ManyTagsAvatarField {
    setup() {
        super.setup();
        this.popover = usePopover();
    }
    get itemsVisible() {
        return this.props.record.activeFields[this.props.name].viewType === "list" ? 5 : 3;
    }

    get tags() {
        return [
            ...super.tags,
            {
                img: "/web/static/img/user_menu_avatar.png",
                onImageClicked: (ev) => this.openPopover(ev),
            },
        ];
    }

    getTagProps(record) {
        return {
            ...super.getTagProps(record),
            img: `/web/image/${this.props.relation}/${record.resId}/avatar_128`,
        };
    }

    openPopover(ev) {
        this.closePopover = this.popover.add(
            ev.currentTarget,
            PopoverComponent,
            {
                autocompleteProps: {
                    id: this.props.id,
                    placeholder: this.tags.length ? "" : this.props.placeholder,
                    resModel: this.props.relation,
                    autoSelect: true,
                    fieldString: this.string,
                    activeActions: this.activeActions,
                    update: this.update,
                    quickCreate: this.activeActions.create ? this.quickCreate : null,
                    context: this.context,
                    getDomain: this.getDomain.bind(this),
                    isToMany: true,
                },
            },
            {
                position: "bottom",
            }
        );
    }
}

registry.category("fields").add("list.many2many_tags_avatar", ListKanbanMany2ManyTagsAvatarField);
registry.category("fields").add("kanban.many2many_tags_avatar", ListKanbanMany2ManyTagsAvatarField);
