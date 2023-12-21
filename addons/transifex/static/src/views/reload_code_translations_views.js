/** @odoo-module **/

import { orm } from "@web/core/orm";
import { registry } from "@web/core/registry";
import { ListController } from "@web/views/list/list_controller";
import { listView } from "@web/views/list/list_view";
import { browser } from "@web/core/browser/browser";

export class TransifexCodeTranslationListController extends ListController {
    async onClickReloadCodeTranslations() {
        await orm.call("transifex.code.translation", "reload", [], {});
        browser.location.reload();
    }
}

registry.category("views").add("transifex_code_translation_tree", {
    ...listView,
    Controller: TransifexCodeTranslationListController,
    buttonTemplate: "transifex.CodeTranslationListView.Buttons",
});
