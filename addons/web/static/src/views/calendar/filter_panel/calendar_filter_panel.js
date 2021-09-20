/** @odoo-module **/

import { usePopover } from "@web/core/popover/popover_hook";

import { _lt } from "@web/core/l10n/translation";
import FieldManagerMixin from "web.FieldManagerMixin";
import * as RelationalFields from "web.relational_fields";
import Widget from "web.Widget";
import { ComponentAdapter } from "web.OwlCompatibility";

const { Component } = owl;
const { useState } = owl.hooks;

const FilterMany2One = RelationalFields.FieldMany2One.extend({
    _getSearchBlacklist() {
        return this._super(...arguments).concat(this.filterIds || []);
    },
});

const FilterMany2OneWrapper = Widget.extend(FieldManagerMixin, {
    custom_events: {
        ...FieldManagerMixin.custom_events,
        field_changed: "onFieldChanged",
    },
    init(_, props) {
        this._super(...arguments);
        FieldManagerMixin.init.call(this);
        this.props = props;
    },
    async willStart() {
        await this._super(...arguments);
        const recordId = await this.model.makeRecord(this.props.write.model, [
            {
                name: this.props.write.field,
                relation: this.props.fields[this.props.fieldName].relation,
                type: "many2one",
            },
        ]);
        this.many2one = new FilterMany2One(this, this.props.write.field, this.model.get(recordId), {
            mode: "edit",
            attrs: {
                string: _lt(this.props.fields[this.props.fieldName].string),
                placeholder: `+ ${_lt("Add")} ${this.props.label}`,
                can_create: false,
            },
        });
    },
    start() {
        this._super();
        if (this.many2one) {
            this.many2one.appendTo(this.$el);
            this.many2one.filterIds = this.props.filterIds;
        }
    },
    onFieldChanged(ev) {
        ev.stopPropagation();
        this.props.onFieldChanged(this.props.fieldName, ev.data.changes[this.props.write.field].id);
    },
    reset(props) {
        this.props = props;
        this.many2one.filterIds = this.props.filterIds;
    },
});

class FilterMany2OneWrapperAdapter extends ComponentAdapter {
    setup() {
        this.env = Component.env;
    }
    get widgetArgs() {
        return [this.props.fieldProps];
    }
    renderWidget() {}
    updateWidget(nextProps) {
        this.widget.reset(nextProps.fieldProps);
    }
}

class CalendarFilterTooltip extends Component {}
CalendarFilterTooltip.template = "web.CalendarFilterPanel.tooltip";

let nextId = 1;

export class CalendarFilterPanel extends Component {
    setup() {
        /** @todo: delete this when fields are converted */
        this.FilterMany2OneWrapper = FilterMany2OneWrapper;

        this.state = useState({
            collapsed: {},
            fieldRev: 1,
        });

        this.popover = usePopover();
        this.removePopover = null;
    }

    getFieldProps(section) {
        return {
            label: section.label,
            fieldName: section.fieldName,
            write: section.write,
            fields: this.props.model.fields,
            filterIds: section.filters.filter((f) => f.type !== "all").map((f) => f.value),
            onFieldChanged: this.onFieldChanged.bind(this),
        };
    }
    get nextFilterId() {
        nextId += 1;
        return nextId;
    }

    isAllActive(section) {
        let active = true;
        for (const filter of section.filters) {
            if (filter.type !== "all" && !filter.active) {
                active = false;
                break;
            }
        }
        return active;
    }
    getFilterTypePriority(type) {
        return ["user", "record", "dynamic", "all"].indexOf(type);
    }
    getSortedFilters(section) {
        return section.filters.slice().sort((a, b) => {
            if (a.type === b.type) {
                const va = a.value ? -1 : 0;
                const vb = b.value ? -1 : 0;
                if (a.type === "dynamic" && va !== vb) {
                    return va - vb;
                }
                return b.label.localeCompare(a.label);
            } else {
                return this.getFilterTypePriority(a.type) - this.getFilterTypePriority(b.type);
            }
        });
    }

    toggleSection(section) {
        if (section.canCollapse) {
            this.state.collapsed[section.fieldName] = !this.state.collapsed[section.fieldName];
        }
    }

    isSectionCollapsed(section) {
        return this.state.collapsed[section.fieldName] || false;
    }

    closeTooltip() {
        if (this.removePopover) {
            this.removePopover();
            this.removePopover = null;
        }
    }

    onFilterInputChange(section, filter, ev) {
        this.props.model.updateFilters(section.fieldName, {
            [filter.value]: ev.target.checked,
        });
    }

    onAllFilterInputChange(section, ev) {
        const filters = {};
        for (const filter of section.filters) {
            if (filter.type !== "all") {
                filters[filter.value] = ev.target.checked;
            }
        }
        this.props.model.updateFilters(section.fieldName, filters);
    }

    onFilterMouseEnter(section, filter, ev) {
        this.closeTooltip();
        if (!section.hasAvatar || !filter.hasAvatar) {
            return;
        }

        this.removePopover = this.popover.add(
            ev.target,
            CalendarFilterTooltip,
            { section, filter },
            {
                closeOnClickAway: false,
                popoverClass: "o-calendar-filter--tooltip",
                position: "top",
            }
        );
    }

    onFilterMouseLeave() {
        this.closeTooltip();
    }

    onFilterRemoveBtnClick(section, filter) {
        this.props.model.unlinkFilter(section.fieldName, filter.recordId);
    }

    onFieldChanged(fieldName, filterValue) {
        this.state.fieldRev += 1;
        this.props.model.createFilter(fieldName, filterValue);
    }
}

CalendarFilterPanel.components = {
    FilterMany2OneWrapperAdapter,
};
CalendarFilterPanel.template = "web.CalendarFilterPanel";
