import { Spreadsheet, registries, components } from "@odoo/o-spreadsheet";
import { onWillDestroy } from "@odoo/owl";
import { patch } from "@web/core/utils/patch";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

const { topbarMenuRegistry } = registries;
const { Grid } = components;

function registerCategories(env) {
    let sequence = 5;
    registry
        .category("command_categories")
        .add("spreadsheet_insert_link", {}, { sequence: 0, force: true });
    for (const menu of topbarMenuRegistry.getMenuItems()) {
        const category = `spreadsheet_${menu.name(env)}`;
        registry.category("command_categories").add(category, {}, { sequence });
        sequence++;
    }
}

patch(Spreadsheet.prototype, {
    setup() {
        super.setup();
        if (this.env.isDashboard()) {
            return;
        }
        this.unregisterCommandCallbacks = [];
        this.command = useService("command");
        registerCategories(this.env);
        for (const menu of topbarMenuRegistry.getMenuItems()) {
            const name = `${menu.name(this.env)}`;
            const category = `spreadsheet_${name}`;
            this._registerCommands(menu, name, category);
        }
        onWillDestroy(() => {
            for (const unregister of this.unregisterCommandCallbacks) {
                unregister();
            }
        });
    },

    _registerCommands(menu, previousName, category) {
        if (!menu.children) {
            return;
        }
        for (const subMenu of menu.children(this.env).sort((a, b) => a.sequence - b.sequence)) {
            if (!subMenu.isVisible(this.env)) {
                continue;
            }
            const subMenuName = `${subMenu.name(this.env)}`;
            if (subMenu.execute) {
                const shortcut = subMenu.description?.(this.env);
                this.unregisterCommandCallbacks.push(
                    this.command.add(
                        `${previousName} / ${subMenuName}`,
                        () => {
                            subMenu.execute(this.env);
                        },
                        {
                            hotkey: shortcut?.startsWith("Ctrl")
                                ? shortcut.replace("Ctrl", "control")
                                : undefined,
                            category:
                                subMenu.id === "insert_link" ? "spreadsheet_insert_link" : category,
                        }
                    )
                );
            } else {
                this._registerCommands(subMenu, `${previousName} / ${subMenuName}`, category);
            }
        }
    },
});

patch(Grid.prototype, {
    setup() {
        super.setup();
        // Remove the Ctrl+K hotkey (open a link) from the grid to avoid conflict
        // with the command palette.
        delete this.keyDownMapping["Ctrl+K"];
    },
});
