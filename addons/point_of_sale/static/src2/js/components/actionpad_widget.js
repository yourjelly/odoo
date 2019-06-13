odoo.define("point_of_sale.ActionpadWidget", function(require) {
    "use strict";

    const { _t } = require("web.core");

    class ActionpadWidget extends owl.Component {}

    ActionpadWidget.props = ["client"];
    ActionpadWidget.defaultProps = {
        client: { name: _t("Customer") },
    };

    return ActionpadWidget;
});
