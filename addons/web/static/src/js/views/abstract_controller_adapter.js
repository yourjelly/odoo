odoo.define('web.AbstractControllerAdapter', function (require) {
    "use strict";

    const AbstractController = require('web.AbstractController');
    const ControllerAdapterMixin = require('web.ControllerAdapterMixin');

    const AbstractControllerAdapter = AbstractController.extend(ControllerAdapterMixin, {
         on_attach_callback() {
            this._super.apply(this, arguments);
            ControllerAdapterMixin.on_attach_callback.call(this);
        },
        on_detach_callback() {
            this._super.apply(this, arguments);
            ControllerAdapterMixin.on_detach_callback.call(this);
        },
    });

    return AbstractControllerAdapter;

});
