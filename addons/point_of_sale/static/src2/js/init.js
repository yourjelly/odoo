odoo.define("point_of_sale.init", function(require) {
    "use strict";

    const Chrome = require("point_of_sale.Chrome");
    const PosDb = require("point_of_sale.DB");
    const { PosModel } = require("point_of_sale.models");
    const Formatters = require("point_of_sale.Formatters");
    const rpc = require("web.rpc");
    const session = require("web.session");

    async function startChrome() {
        const [templates] = await Promise.all([
            owl.utils.loadTemplates("/point_of_sale/static/src2/xml/pos.xml"),
            owl.utils.whenReady(),
        ]);
        const qweb = new owl.QWeb(templates);
        const db = new PosDb();
        const model = new PosModel(session, { db }, rpc.query.bind(rpc));
        const formatters = new Formatters(model);
        const env = { qweb, model, formatters };
        const pos = new Chrome(env);
        pos.mount(document.body);
    }

    startChrome();
});

// FIXME: this is ugly and shouldn't exist... and probably breaks Tours...
odoo.define("root.widget", function(require) {
    const core = require("web.core");
    return new core.Class();
});

// FIXME: this is ugly and shouldn't exist... and probably breaks Tours...
odoo.define("point_of_sale.BaseWidget", function(require) {
    const core = require("web.core");
    return new core.Class();
});
