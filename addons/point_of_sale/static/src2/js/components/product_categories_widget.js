odoo.define("point_of_sale.ProductCategoriesWidget", function() {
    "use strict";

    class ProductCategoriesWidget extends owl.Component {}

    ProductCategoriesWidget.props = ["category", "breadcrumb", "subcategories"];
    ProductCategoriesWidget.defaultProps = {
        breadcrumb: [],
        subcategories: [],
    };

    return ProductCategoriesWidget;
});
