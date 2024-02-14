/** @odoo-module */

export function clickPartner(name = "") {
    return {
        content: `click partner '${name}' from partner list screen`,
        trigger: `.partner-list td:contains("${name}")`,
        in_modal: true,
    };
}

export function searchPartner(name) {
    return [
        {
            content: "click search button",
            trigger: "div.search-customer button",
            in_modal: true,
            run: `click`,
            mobile: true,
        },
        {
            content: "click search button",
            trigger: "input[placeholder='Search Customers...']",
            in_modal: true,
            run: `text ${name}`,
        },
        {
            content: "click search more button",
            trigger: "button:contains('Search more')",
            in_modal: true,
        },
    ];
}
