import { Component, useState } from "@odoo/owl";

import { useService } from "@web/core/utils/hooks";

export class LanguageList extends Component {
    static props = {};
    static template = "t9n.LanguageList";

    setup() {
        this.action = useService("action");
        this.state = useState({
            filters: {
                searchText: "",
            },
            sorting: {
                column: "name",
                order: "asc",
            },
        });
        this.store = useState(useService("t9n.store"));
        this.store.fetchLanguages();
    }

    get languages() {
        const searchTerms = this.state.filters.searchText.trim().toUpperCase();
        const languages = searchTerms
            ? this.store.languages.filter((l) => l.name.toUpperCase().includes(searchTerms))
            : [...this.store.languages];

        languages.sort((l1, l2) => {
            let l1Col = l1[this.state.sorting.column];
            let l2Col = l2[this.state.sorting.column];

            l1Col = l1Col.toLowerCase();
            l2Col = l2Col.toLowerCase();

            if (l1Col < l2Col) {
                return this.state.sorting.order === "asc" ? -1 : 1;
            }
            if (l1Col > l2Col) {
                return this.state.sorting.order === "asc" ? 1 : -1;
            }
            return 0;
        });
        return languages;
    }

    onClickColumnName(column) {
        if (this.state.sorting.column === column) {
            this.state.sorting.order = this.state.sorting.order === "asc" ? "desc" : "asc";
        } else {
            this.state.sorting.column = column;
            this.state.sorting.order = "asc";
        }
    }

    onClickLanguage(id) {
        this.store.setTargetLangId(id);
        this.action.doAction({
            type: "ir.actions.client",
            tag: "t9n.open_resource_list",
            target: "current",
        });
    }
}
