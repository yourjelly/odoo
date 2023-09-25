/** @odoo-module */

const mocks = {
    "@web/core/network/rpc_service": function () {
        return {
            rpcService: {},
        };
    },
};

const define = odoo.define;
for (const mock in mocks) {
    odoo.define(mock, [], mocks[mock]);
}
odoo.define = function (name, ...args) {
    if (name in mocks) {
        return;
    }
    define(name, ...args);
};
