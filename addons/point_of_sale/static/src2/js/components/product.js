odoo.define("point_of_sale.Product", function() {
    "use strict";

    class Product extends owl.Component {
        get price() {
            const { product, pricelist } = this.props;
            return product.get_price(pricelist, 1);
        }

        get formattedPrice() {
            return this.env.formatters.formatCurrency(this.price, "Product Price");
        }

        get unit() {
            const { unitsByUOM, product } = this.props;
            return unitsByUOM[product.uom_id[0]];
        }

        get imageUrl() {
            return `/web/image?model=product.product&field=image_128&id=${
                this.props.product.id
            }`;
        }
    }

    Product.props = ["product", "pricelist", "unit"];

    return Product;
});
