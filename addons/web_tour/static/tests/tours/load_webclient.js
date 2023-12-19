/** @odoo-module */
import tour from "web_tour.tour";

tour.register(
    "load_webclient",
    {
        url: "/web",
        sequence: 10,
    },
    [{ trigger: "body", run: () => {} }]
);
