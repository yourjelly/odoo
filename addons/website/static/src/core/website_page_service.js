import { registry } from "@web/core/registry";

registry.category("services").add("website_page", {
    start() {
    },
    getMainObject() {
        const htmlEl = document.querySelector("html");
        const match = htmlEl.dataset.mainObject.match(/(.+)\((\d+),(.*)\)/);
        return {
            model: match[1],
            id: match[2] | 0,
        };
    },
});
