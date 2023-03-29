/** @odoo-module **/

import { Component } from "@odoo/owl";
import { ViewScaleSelector } from "@web/views/view_components/view_scale_selector";
import { _lt } from "@web/core/l10n/translation";

export const SCALE_LABELS = {
    day: _lt("Day"),
    week: _lt("Week"),
    month: _lt("Month"),
    year: _lt("Year"),
};

export class CalendarHeader extends Component {
    static template = "web.CalendarHeader";
    static props = {
        title: String,
        model: Object,
    };
    static components = {
        ViewScaleSelector,
    };

    async setDate(move) {
        let date = null;
        switch (move) {
            case "next":
                date = this.props.model.date.plus({ [`${this.props.model.scale}s`]: 1 });
                break;
            case "previous":
                date = this.props.model.date.minus({ [`${this.props.model.scale}s`]: 1 });
                break;
            case "today":
                date = luxon.DateTime.local().startOf("day");
                break;
        }
        await this.props.model.load({ date });
    }

    get scales() {
        return Object.fromEntries(
            this.props.model.scales.map((s) => [s, { description: SCALE_LABELS[s] }])
        );
    }

    async setScale(scale) {
        await this.props.model.load({ scale });
    }
}
