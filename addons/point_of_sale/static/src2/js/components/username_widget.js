odoo.define("point_of_sale.UsernameWidget", function(require) {
    "use strict";

    const { connect } = require("point_of_sale.BackboneStore");

    class UsernameWidget extends owl.Component {}
    UsernameWidget.props = ["name"];
    UsernameWidget.defaultProps = {
        name: "unknown",
    };

    function mapModelToProps(model) {
        const { name } = model.get_cashier();
        return {
            name,
        };
    }

    return connect(
        UsernameWidget,
        mapModelToProps
    );
});
