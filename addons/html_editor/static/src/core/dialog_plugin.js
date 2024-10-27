import { Plugin } from "../plugin";

/**
 * @typedef {Object} DialogShared
 * @property {DialogPlugin['addDialog']} addDialog
 */

export class DialogPlugin extends Plugin {
    static id = "dialog";
    static dependencies = ["selection"];
    static shared = ["addDialog"];

    addDialog(dialogClass, props, options = {}) {
        return new Promise((resolve) => {
            this.services.dialog.add(dialogClass, props, {
                onClose: () => {
                    this.dependencies.selection.focusEditable();
                    resolve();
                },
                ...options,
            });
        });
    }
}
