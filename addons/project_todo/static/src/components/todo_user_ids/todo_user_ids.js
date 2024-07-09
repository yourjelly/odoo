/** @odoo-module */
import { usePopover } from "@web/core/popover/popover_hook";
import {
    Many2ManyTagsAvatarFieldPopover,
    Many2ManyTagsAvatarField,
} from "@web/views/fields/many2many_tags_avatar/many2many_tags_avatar_field";
import { _t } from "@web/core/l10n/translation";


export class TodoUserIds extends Many2ManyTagsAvatarField {
static template = "todo.TodoMany2ManyTagsAvatarUserField";
    setup() {
        super.setup();
        this.placeholder = _t("Add Users");
        this.popover = usePopover(Many2ManyTagsAvatarFieldPopover, {
            popoverClass: "o_m2m_tags_avatar_field_popover",
            closeOnClickAway: (target) => !target.closest(".modal"),
        });
    }
    openPopover(ev) {
        this.popover.open(ev.currentTarget.parentElement, {
            ...this.props,
            canCreate: false,
            canCreateEdit: false,
            canQuickCreate: false,
            placeholder: _t("Search users..."),
        });
    }
}
