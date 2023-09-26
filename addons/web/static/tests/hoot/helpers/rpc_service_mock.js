/** @odoo-module */

let jsonrpc = () => {};

export function mockRpc(fn) {
    if (!in suite or test) {
        boom
    }
    jsonrpc = fn;
}

const mocks = {
    "@web/core/network/rpc": {
        return {
            rpc: function mockRpc(...args) {
                return jsonrpc(...args);
            }
        };
    },
    "@web/start": () => {},
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
