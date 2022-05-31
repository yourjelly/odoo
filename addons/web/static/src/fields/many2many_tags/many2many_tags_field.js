/** @odoo-module **/

import { registry } from "@web/core/registry";
import { _lt } from "@web/core/l10n/translation";
import { standardFieldProps } from "../standard_field_props";

import { CheckBox } from "@web/core/checkbox/checkbox";
import { ColorList } from "@web/core/colorlist/colorlist";
import { TagsList } from "./tags_list";
import { Domain } from "@web/core/domain";
import { useService } from "@web/core/utils/hooks";
import { usePopover } from "@web/core/popover/popover_hook";

import { useX2ManyCrud, useActiveActions, Many2XAutocomplete } from "../relational_utils";

const { Component } = owl;

class Many2ManyTagsFieldColorListPopover extends Component {}
Many2ManyTagsFieldColorListPopover.template = "web.Many2ManyTagsFieldColorListPopover";
Many2ManyTagsFieldColorListPopover.components = {
    CheckBox,
    ColorList,
};

export class Many2ManyTagsField extends Component {
    setup() {
        this.orm = useService("orm");
        this.previousColorsMap = {};
        this.popover = usePopover();
        this.dialog = useService("dialog");
        this.dialogClose = [];

        const { saveRecord, removeRecord } = useX2ManyCrud(() => this.props.value, true);

        const activeField = this.props.record.activeFields[this.props.name];

        this.activeActions = useActiveActions({
            fieldType: "many2many",
            crudOptions: {
                create: this.props.canQuickCreate && activeField.options.create,
                onDelete: removeRecord,
            },
            getEvalParams: (props) => {
                return {
                    evalContext: props.record.evalContext,
                    readonly: props.readonly,
                };
            },
        });

        this.fieldString = activeField.string;

        this.update = (recordlist) => {
            if (Array.isArray(recordlist)) {
                const resIds = recordlist.map((rec) => rec.id);
                return saveRecord(resIds);
            }
            return saveRecord(recordlist);
        };

        if (this.props.canQuickCreate) {
            this.quickCreate = async (name) => {
                const created = await this.orm.call(this.props.relation, "name_create", [name], {
                    context: this.props.context,
                });
                return saveRecord([created[0]]);
            };
        }
    }

    get context() {
        return this.props.record.getFieldContext(this.props.name);
    }

    get tags() {
        return this.props.value.records.map((record) => ({
            id: record.id, // datapoint_X
            text: record.data.display_name,
            colorIndex: record.data[this.props.colorField],
            onClick: (ev) => this.onBadgeClick(ev, record),
            onDelete: !this.props.readonly ? () => this.onDelete(record.id) : undefined,
        }));
    }
    get canOpenColorDropdown() {
        return this.handlesColor() && this.props.canEditColor;
    }
    get showM2OSelectionField() {
        return !this.props.readonly;
    }
    handlesColor() {
        return this.props.colorField !== undefined && this.props.colorField !== null;
    }
    switchTagColor(colorIndex, tag) {
        const tagRecord = this.props.value.records.find((record) => record.id === tag.id);
        tagRecord.update({ [this.props.colorField]: colorIndex });
        tagRecord.save();
        this.closePopover();
    }
    onTagVisibilityChange(isHidden, tag) {
        const tagRecord = this.props.value.records.find((record) => record.id === tag.id);
        if (tagRecord.data[this.props.colorField] != 0) {
            this.previousColorsMap[tagRecord.resId] = tagRecord.data[this.props.colorField];
        }
        tagRecord.update({
            [this.props.colorField]: isHidden ? 0 : this.previousColorsMap[tagRecord.resId] || 1,
        });
        tagRecord.save();
        this.closePopover();
    }

    closePopover() {
        this.popoverCloseFn();
        this.popoverCloseFn = null;
    }

    getDomain() {
        return Domain.and([
            this.props.domain,
            Domain.not([["id", "in", this.props.value.currentIds]]),
        ]).toList(this.props.context);
    }

    onDelete(id) {
        const tagRecord = this.props.value.records.find((record) => record.id === id);
        const ids = this.props.value.currentIds.filter((id) => id !== tagRecord.resId);
        this.props.value.replaceWith(ids);
    }

    onBadgeClick(ev, record) {
        if (!this.canOpenColorDropdown) return;
        const isClosed = !document.querySelector(".o_tag_popover");
        if (isClosed) {
            this.currentPopoverEl = null;
        }
        if (this.popoverCloseFn) {
            this.closePopover();
        }
        if (isClosed || this.currentPopoverEl !== ev.currentTarget) {
            this.currentPopoverEl = ev.currentTarget;
            this.popoverCloseFn = this.popover.add(
                ev.currentTarget,
                this.constructor.components.Popover,
                {
                    colors: this.constructor.RECORD_COLORS,
                    tag: {
                        id: record.id,
                        colorIndex: record.data[this.props.colorField],
                    },
                    switchTagColor: this.switchTagColor.bind(this),
                    onTagVisibilityChange: this.onTagVisibilityChange.bind(this),
                }
            );
        }
    }
}

Many2ManyTagsField.RECORD_COLORS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
Many2ManyTagsField.SEARCH_MORE_LIMIT = 320;

Many2ManyTagsField.template = "web.Many2ManyTagsField";
Many2ManyTagsField.components = {
    Popover: Many2ManyTagsFieldColorListPopover,
    TagsList,
    Many2XAutocomplete,
};

Many2ManyTagsField.props = {
    ...standardFieldProps,
    canEditColor: { type: Boolean, optional: true },
    canQuickCreate: { type: Boolean, optional: true },
    colorField: { type: String, optional: true },
    placeholder: { type: String, optional: true },
    relation: { type: String },
    domain: { type: Domain },
    context: { type: Object },
    nameCreateField: { type: String, optional: true },
    itemsVisible: { type: Number, optional: true },
};
Many2ManyTagsField.defaultProps = {
    canEditColor: true,
    canQuickCreate: true,
    nameCreateField: "name",
};

Many2ManyTagsField.displayName = _lt("Tags");
Many2ManyTagsField.supportedTypes = ["many2many"];
Many2ManyTagsField.fieldsToFetch = {
    display_name: { name: "display_name", type: "char" },
};

Many2ManyTagsField.extractProps = (fieldName, record, attrs) => {
    return {
        colorField: attrs.options.color_field,
        nameCreateField: attrs.options.create_name_field,
        canEditColor:
            !attrs.options.no_edit_color && record.activeFields[fieldName].viewType !== "list",
        relation: record.activeFields[fieldName].relation,
        domain: record.getFieldDomain(fieldName),
        context: record.getFieldContext(fieldName),
        canQuickCreate: !attrs.options.no_quick_create,
    };
};

registry.category("fields").add("many2many_tags", Many2ManyTagsField);
registry.category("fields").add("form.many2many_tags", Many2ManyTagsField);
registry.category("fields").add("list.many2many_tags", Many2ManyTagsField);
