import { ProductScreen } from "@point_of_sale/app/screens/product_screen/product_screen";
import { patch } from "@web/core/utils/patch";
import { onMounted } from "@odoo/owl";

patch(ProductScreen.prototype, {
    /**
     * @override
     */
    setup() {
        super.setup(...arguments);

        onMounted(() => {
            this.pos.addPendingOrder([this.pos.getOrder().id]);
        });
    },
    get selectedOrderlineQuantity() {
        const order = this.pos.getOrder();
        const orderline = order.get_selected_orderline();
        const isForPreparation = orderline.product_id.pos_categ_ids
            .map((categ) => categ.id)
            .some((id) => this.pos.orderPreparationCategories.has(id));
        if (
            this.pos.config.module_pos_restaurant &&
            this.pos.orderPreparationCategories.size &&
            isForPreparation
        ) {
            const changes = Object.values(this.pos.getOrderChanges().orderlines).find(
                (change) => change.name == orderline.get_full_product_name()
            );
            return changes ? changes.quantity : false;
        }
        return super.selectedOrderlineQuantity;
    },
    get nbrOfChanges() {
        return this.pos.getOrderChanges().nbrOfChanges;
    },
    get swapButton() {
        return this.pos.config.module_pos_restaurant && this.pos.orderPreparationCategories.size;
    },
    get displayCategoryCount() {
        return this.pos.categoryCount.slice(0, 3);
    },
    async submitOrder() {
        this.pos.sendOrderInPreparationUpdateLastChange(this.currentOrder);
    },
    get primaryReviewButton() {
        return (
            !this.primaryOrderButton &&
            !this.pos.getOrder().is_empty() &&
            this.pos.config.module_pos_restaurant
        );
    },
    get primaryOrderButton() {
        return (
            this.pos.getOrderChanges().nbrOfChanges !== 0 && this.pos.config.module_pos_restaurant
        );
    },
});
