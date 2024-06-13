/** @odoo-module **/

import { registry } from "@web/core/registry";
import { ListController } from "@web/views/list/list_controller";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { _t } from "@web/core/l10n/translation";
import { listView } from "@web/views/list/list_view";
import { browser } from "@web/core/browser/browser";
import { useService } from "@web/core/utils/hooks";

export class OrmCacheUsageListController extends ListController {
    setup() {
        super.setup();
        this.orm = useService("orm");
        this.dialogService = useService('dialog');
    }

    async onClickUpdate() {
        await this.orm.call("orm.cache.usage", "update_usage", [], {});
        browser.location.reload();
    }
    async onClickCleanup() {
        await this.orm.call("orm.cache.usage", "cleanup_usage", [], {});
        browser.location.reload();
    }

    async onClickRegistry() {
        const size = await this.orm.call("orm.cache.usage", "get_registry_size", [], {});
        this.dialogService.add(AlertDialog, {
            title: "Registry Size",
            body: `for models and fields: ${size} bytes`,
            confirmLabel: _t("Close"),
        });
    }

    async onClickORMCache() {
        const msg = await this.orm.call("orm.cache.usage", "get_ormcache_usage", [], {});
        this.dialogService.add(AlertDialog, {
            title: "ORM Cache",
            body: msg,
            confirmLabel: _t("Close"),
        });
    }
}

registry.category("views").add("orm_cache_usage_tree", {
    ...listView,
    Controller: OrmCacheUsageListController,
    buttonTemplate: "ormcache.OrmCacheUsageTreeView.Buttons",
});
