
/** @odoo-module */
import { Many2ManyTagsField } from "@web/views/fields/many2many_tags/many2many_tags_field";
import { usePopover } from "@web/core/popover/popover_hook";
import { Many2ManyTagsAvatarFieldPopover } from "@web/views/fields/many2many_tags_avatar/many2many_tags_avatar_field";
import { _t } from "@web/core/l10n/translation";
import { Many2XAutocomplete } from "@web/views/fields/relational_utils";
import { TagsList } from "@web/core/tags_list/tags_list";


export class TodoTagsList extends TagsList {
    get visibleTags() {
        let tags = this.props.tags;
        tags.forEach(tag => tag.img = false);
        return tags;
    }
}

export class TodoMany2ManyTagsFieldPopover extends Many2ManyTagsAvatarFieldPopover {
    static components = {
        ...Many2ManyTagsAvatarFieldPopover.components,
        TagsList: TodoTagsList,
        Many2XAutocomplete: Many2XAutocomplete,
    };
}

export class TodoTagIds extends Many2ManyTagsField {
    static template = "project_todo.TodoTagIds";
    setup() {
        super.setup();
        this.placeholder = _t("Add Tags");
        this.popover = usePopover(TodoMany2ManyTagsFieldPopover, {
            popoverClass: "o_m2m_tags_field_popover",
            closeOnClickAway: (target) => !target.closest(".modal"),
        });
    }
    openTagPopover(ev) {
        this.popover.open(ev.currentTarget.parentElement, {
            ...this.props,
            canCreate: false,
            canCreateEdit: false,
            canQuickCreate: false,
            placeholder: _t("Search tags..."),
        });
    }
}
