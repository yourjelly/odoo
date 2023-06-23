odoo.define(
    "web.test_legacy",
    ["web.session", "@web/../tests/helpers/session", "@web/../tests/legacy/helpers/test_utils"],
    async (require) => {
        require("@web/../tests/helpers/session")[Symbol.for('default')];
        require("@web/../tests/legacy/helpers/test_utils")[Symbol.for('default')];
        const session = require("web.session");
        await session.is_bound; // await for templates from server

        return { legacyProm: session.is_bound };
    }
);
