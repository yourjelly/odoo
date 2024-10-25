import { Plugin } from "../plugin";

export class ShortCutPlugin extends Plugin {
    static id = "shortcut";
    static dependencies = ["userCommand"];

    setup() {
        const hotkeyService = this.services.hotkey;
        if (!hotkeyService) {
            throw new Error("ShorcutPlugin needs hotkey service to properly work");
        }
        if (document !== this.document) {
            hotkeyService.registerIframe({ contentWindow: this.document.defaultView });
        }
        for (const shortcut of this.getResource("shortcuts")) {
            this.addShortcut(shortcut.hotkey, () => {
                this.shared.execCommand(shortcut.commandId, shortcut.commandParams);
            });
        }
    }

    addShortcut(hotkey, action) {
        this.services.hotkey.add(hotkey, action, {
            area: () => this.editable,
            bypassEditableProtection: true,
            allowRepeat: true,
        });
    }
}
