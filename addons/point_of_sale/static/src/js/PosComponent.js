odoo.define('point_of_sale.PosComponent', function (require) {
    'use strict';

    const { Component } = owl;

    class PosComponent extends Component {
        showTempScreen(name, props) {
            return new Promise((resolve) => {
                this.trigger('show-temp-screen', { name, props, resolve });
            });
        }
        async rpc() {
            return await this.env.model._rpc(...arguments);
        }
    }

    return PosComponent;
});
