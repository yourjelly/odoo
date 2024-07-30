import { registry } from "@web/core/registry";
registry.category("web_tour.tours").add('loyalty_portal_tour', {
    url: '/my',  // Here, you can specify any other starting url
    test: true,
    steps: () => [
    {
        trigger: "div[class='portal-loyalty-buttons']",
    },
]});
