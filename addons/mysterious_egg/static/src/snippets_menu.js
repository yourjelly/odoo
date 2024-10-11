import { Component, onWillDestroy, useState } from "@odoo/owl";
import { Notebook } from "@web/core/notebook/notebook";
import { blockTab } from "./snippets_menu_tabs/block_tab";
import { customizeTab } from "./snippets_menu_tabs/customize_tab";
import { registry } from "@web/core/registry";
import { Editor } from "@html_editor/editor";
import { MAIN_PLUGINS } from "@html_editor/plugin_sets";
import { BuilderOverlayPlugin } from "@mysterious_egg/builder_overlay_plugin/builder_overlay_plugin";

const BUILDER_PLUGIN = [BuilderOverlayPlugin];

function onIframeLoaded(iframe, callback) {
    const doc = iframe.contentDocument;
    if (doc.readyState === "complete") {
        callback();
    } else {
        iframe.contentWindow.addEventListener("load", callback, { once: true });
    }
}

export class SnippetsMenu extends Component {
    static template = "mysterious_egg.SnippetsMenu";
    static components = { Notebook };
    static props = ["iframe"];

    setup() {
        this.pages = [blockTab, customizeTab];
        this.state = useState({ canUndo: true, canRedo: true });
        this.editor = new Editor(
            {
                Plugins: [...MAIN_PLUGINS, ...BUILDER_PLUGIN],
            },
            this.env.services,
        );
        onIframeLoaded(this.props.iframe, () => {
            this.editor.attachTo(this.props.iframe.contentDocument.body);
        });
        onWillDestroy(() => this.editor.destroy());
    }
}

registry.category("lazy_components").add("website.SnippetsMenu", SnippetsMenu);
