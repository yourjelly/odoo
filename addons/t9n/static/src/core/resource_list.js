import { Component, useState } from "@odoo/owl";

import { useService } from "@web/core/utils/hooks";

export class ResourceList extends Component {
    static props = {};
    static template = "t9n.ResourceList";

    setup() {
        this.action = useService("action");
        this.state = useState({
            filters: {
                searchText: "",
            },
            sorting: {
                column: "fileName",
                order: "asc",
            },
        });
        this.store = useState(useService("t9n.store"));
        this.store.fetchResources();
    }

    get resources() {
        const searchTerms = this.state.filters.searchText.trim().toUpperCase();
        const resources = searchTerms
            ? this.store.resources.filter((r) => r.fileName.toUpperCase().includes(searchTerms))
            : [...this.store.resources];

        resources.sort((r1, r2) => {
            let r1Col = r1[this.state.sorting.column];
            let r2Col = r2[this.state.sorting.column];

            r1Col = r1Col.toLowerCase();
            r2Col = r2Col.toLowerCase();

            if (r1Col < r2Col) {
                return this.state.sorting.order === "asc" ? -1 : 1;
            }
            if (r1Col > r2Col) {
                return this.state.sorting.order === "asc" ? 1 : -1;
            }
            return 0;
        });
        return resources;
    }

    onClickColumnName(column) {
        if (this.state.sorting.column === column) {
            this.state.sorting.order = this.state.sorting.order === "asc" ? "desc" : "asc";
        } else {
            this.state.sorting.column = column;
            this.state.sorting.order = "asc";
        }
    }

    onClickResource(id) {
        this.store.setResourceId(id);
        this.action.doAction({
            type: "ir.actions.client",
            tag: "t9n.open_resource_page",
            target: "current",
        });
    }
}
