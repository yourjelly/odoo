import { ListController } from "@web/views/list/list_controller";
import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";

// the controller usually contains the Layout and the renderer.
class BurgerMenuListController extends ListController {
    static template = "point_of_sale.BurgerMenuListView";
    // Your logic here, override or insert new methods...
    // if you override setup(), don't forget to call super.setup()
}
console.log("list view", listView);
export const customListView = {
    ...listView,
    Controller: BurgerMenuListController,
};

registry.category("views").add("burger_menu_list", BurgerMenuListController);
