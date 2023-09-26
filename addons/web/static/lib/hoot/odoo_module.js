odoo.define("@odoo/hoot", ["@web/../lib/hoot/hoot"], (require) => {
    "use strict";

    return require("@web/../lib/hoot/hoot");
});

odoo.define(
    "@odoo/hoot/helpers",
    [
        "@web/../lib/hoot/helpers/concurrency",
        "@web/../lib/hoot/helpers/date",
        "@web/../lib/hoot/helpers/dom",
        "@web/../lib/hoot/helpers/events",
    ],
    (require) => {
        "use strict";

        return Object.assign(
            {},
            require("@web/../lib/hoot/helpers/concurrency"),
            require("@web/../lib/hoot/helpers/date"),
            require("@web/../lib/hoot/helpers/dom"),
            require("@web/../lib/hoot/helpers/events")
        );
    }
);
