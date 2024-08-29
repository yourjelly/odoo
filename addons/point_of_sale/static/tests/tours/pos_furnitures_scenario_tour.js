import { registry } from "@web/core/registry";

registry.category("web_tour.tours").add("point_of_sale_furnitures_scenario_tour", {
    url: "/odoo/point-of-sale",
    rainbowMan: false,
    sequence: 55,
    steps: () => [
        {
            trigger: ".o_pos_kanban",
            position: "bottom",
            run: "click",
        },
        {
            trigger: "h3[class='card-title fw-bolder']:contains('Furnitures')",
            position: "bottom",
            run: "click",
        },
    ],
});
