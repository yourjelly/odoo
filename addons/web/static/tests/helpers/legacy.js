odoo.define(
    "web.test_legacy",
    ["web.session", "@web/../tests/helpers/session", "web.test_utils"],
    async (require) => {
        require("@web/../tests/helpers/session")[Symbol.for('default')];
        require("web.test_utils");
        const session = require("web.session");
        await session.is_bound; // await for templates from server

        return { legacyProm: session.is_bound };
    }
);
