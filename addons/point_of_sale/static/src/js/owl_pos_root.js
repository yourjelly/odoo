odoo.define('point_of_sale.owlPosRoot', function (require) {
    "use strict";

    const ActionManager = require('web.ActionManager');

    class PosRoot extends owl.Component {
        constructor() {
            super(...arguments);
            // Pos needs to be able to print Invoices
            // this is the SOLE purpose of this actionManager
            // LPE FIXME
            const amExtensions = {
                'ir.actions.report': {},
                'ir.actions.act_url': {},
            };
            this.env.actionManager = new ActionManager(amExtensions, {env: this.env});
            this.chromeRef = owl.hooks.useRef('chromeRef');
        }
        mounted() {
            odoo.isReady = true;
            this.env.bus.trigger('web-client-mounted');
            super.mounted();
            this.chromeRef.comp.start();
        }
    }
    PosRoot.template = owl.tags.xml`
        <Chrome t-att-class="'o_action_manager'" t-ref="chromeRef"/>
    `;

    return PosRoot;
});