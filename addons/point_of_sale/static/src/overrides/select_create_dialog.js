import { patch } from "@web/core/utils/patch";
import { SelectCreateDialog } from "@web/views/view_dialogs/select_create_dialog";

//FIXME
patch(SelectCreateDialog.prototype, {
    get viewProps() {
        return {
            ...super.viewProps,
            // type: "kanban",
            // forceGlobalClick: true,
            vlad: "vlad123",
        };
    },
});
