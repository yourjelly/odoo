/** @odoo-module **/

// Component to create new property tags

import { _lt } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
const { Component, useState, onWillUpdateProps } = owl;
import { TagsList } from "@web/views/fields/many2many_tags/tags_list";
import { ColorList } from "@web/core/colorlist/colorlist";
import { usePopover } from "@web/core/popover/popover_hook";

class PropertyTagsDefinitionColorListPopover extends Component {}
PropertyTagsDefinitionColorListPopover.template = "web.PropertyTagsDefinitionColorListPopover";
PropertyTagsDefinitionColorListPopover.components = {
    ColorList,
};

export class PropertyTagsDefinition extends Component {
    setup() {
        this.notification = useService("notification");
        this.popover = usePopover();
    }

    get currentTags() {
        if (!this.props.value) {
            return [];
        }
        return this.props.value.map(tag => {
            return {
                'id': tag[0],
                'text': tag[1],
                'colorIndex': tag[2] || 0,
                'onClick': (event) => this.onTagClick(event, tag[0], tag[2]),
                'onDelete': !this.props.readonly && (() => this.onTagDelete(tag[0])),
            };
        });
    }

    get currentValue() {
        // deep copy to not change the object and be able to discard change
        return JSON.parse(JSON.stringify(this.props.value || []));
    }

    onNewTag(event) {
        if (event.key !== 'Enter') {
            return;
        }

        const target = event.target;
        const newLabel = target.value;

        if (!newLabel || !newLabel.length) {
            return;
        }
        target.value = '';

        const newValue = this.labelToValue(newLabel);

        const existingTags = this.props.value.find(tag => tag[0] === newValue);
        if (existingTags) {
            this.notification.add(
                _lt('This tag is already available'),
                { type: 'warning' },
            );
            return;
        }

        const tagColor = parseInt(Math.random() * ColorList.COLORS.length);
        const value = [...this.currentValue, [newValue, newLabel, tagColor]];
        this.props.onChange(value);
    }

    /**
     * Transform the label into a value
     */
    labelToValue(label) {
        if (!label) {
            return '';
        }
        return label.toLowerCase().replace(' ', '_');
    }

    onTagClick(event, tagId, tagColor) {
        console.log("onTagClick", tagId, tagColor)

        this.popoverCloseFn = this.popover.add(
            event.currentTarget,
            this.constructor.components.Popover,
            {
                colors: [...Array(ColorList.COLORS.length).keys()],
                tag: { id: tagId, colorIndex: tagColor },
                switchTagColor: this.onSwitchTagColor.bind(this),
            }
        );
    }

    onTagDelete(tagId) {
        const value = this.currentValue.filter(tag => tag[0] !== tagId);
        this.props.onChange(value);
    }

    onSwitchTagColor(colorIndex, currentTag) {
        console.log('onSwitchTagColor', colorIndex, currentTag);
        const value = this.currentValue;
        value.find(tag => tag[0] === currentTag.id)[2] = colorIndex;
        this.props.onChange(value);

        // close the color popover
        this.popoverCloseFn();
        this.popoverCloseFn = null;
    }
}

PropertyTagsDefinition.template = "web.PropertyTagsDefinition";
PropertyTagsDefinition.components = {
    TagsList,
    ColorList,
    Popover: PropertyTagsDefinitionColorListPopover,
};
PropertyTagsDefinition.props = {
    value: {},
    readonly: { type: Boolean, optional: true },
    onChange: { type: Function, optional: true },
};
