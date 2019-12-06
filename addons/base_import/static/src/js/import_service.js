odoo.define('base_import.owl_import_service', async function(require) {
    "use strict";

const session = require("web.session");
const AbstractService = require('web.AbstractService');
const { _t, _lt, serviceRegistry } = require('web.core');

const qwebOwl = new owl.QWeb({ translateFn: _t});

const OwlImportService = AbstractService.extend({

    init() {
        this._super(...arguments);
        this._env = undefined;
    },
    start() {
        this._super(...arguments);
        session.is_bound.then(() => {
            qwebOwl.addTemplates(session.templatesString);
            this._env = {
                _lt, _t,
                _: _,
                qweb: qwebOwl,
                session: session,
                call: (...args) => this.call(...args),
                do_action: (...args) => this.do_action(...args),
                do_notify: (...args) => this.do_notify(...args),
                do_warn: (...args) => this.do_warn(...args),
                rpc: (...args) => this._rpc(...args),
                trigger_up: (...args) => this.trigger_up(...args),
            };
        });
    },
    getEnv() {
        return this._env;
    },

});

serviceRegistry.add('owl_import_service', OwlImportService);

return OwlImportService;

});