/** @odoo-module */

import { Component, useEffect, useRef } from "@odoo/owl";
import { CenteredIcon } from "@point_of_sale/app/generic_components/centered_icon/centered_icon";

export class OrderWidget extends Component {
    static template = "point_of_sale.OrderWidget";
    static props = {
        lines: { type: Array, element: Object },
        slots: { type: Object },
        total: { type: String, optional: true },
        tax: { type: String, optional: true },
        groupBy: {
            type: Object,
            optional: true,
            shape: {
                key: String,
                data: Object,
                onClick: Function,
            },
        },
    };
    static components = { CenteredIcon };
    setup() {
        this.scrollableRef = useRef("scrollable");
        useEffect(() => {
            this.scrollableRef.el
                ?.querySelector(".orderline.selected")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    getGroupedLines() {
        const key = this.props.groupBy.key;
        const filteredLines = this.props.lines.reduce((acc, line) => {
            if (!acc[line[key]] && line[key]) {
                const group = this.props.groupBy.data[line[key]];

                acc[line[key]] = {
                    id: group.id,
                    lines: [],
                    group: group.name,
                    onClick: () => this.props.groupBy.onClick(group),
                };
            } else if (!line[key] && !acc["no_group"]) {
                acc["no_group"] = {
                    id: "no_group",
                    lines: [],
                    group: "No Group",
                    onClick: () => this.props.groupBy.onClick(null),
                };
            }

            acc[line[key] || "no_group"].lines.push(line);
            return acc;
        }, {});

        for (const data of Object.values(filteredLines)) {
            data.lines = data.lines.sort((a, b) => a.id - b.id);
        }

        return Object.values(filteredLines);
    }
}
