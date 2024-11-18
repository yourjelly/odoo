import { Editor } from "@html_editor/editor";
import { MAIN_PLUGINS } from "@html_editor/plugin_sets";
import { Component, EventBus, onWillDestroy, onWillStart, useState, useSubEnv } from "@odoo/owl";
import { useHotkey } from "@web/core/hotkeys/hotkey_hook";
import { registry } from "@web/core/registry";
import { BuilderOverlayPlugin } from "./plugins/builder_overlay/builder_overlay_plugin";
import { DropZonePlugin } from "./plugins/drop_zone_plugin";
import { ElementToolboxPlugin } from "./plugins/element_toolbox_plugin";
import { MediaWebsitePlugin } from "./plugins/media_website_plugin";
import { SetupEditorPlugin } from "./plugins/setup_editor_plugin";
import { SnippetModel } from "./snippet_model";
import { BlockTab, blockTab } from "./snippets_menu_tabs/block_tab";
import { CustomizeTab, customizeTab } from "./snippets_menu_tabs/customize_tab";
import { useService } from "@web/core/utils/hooks";

const BUILDER_PLUGIN = [
    ElementToolboxPlugin,
    BuilderOverlayPlugin,
    DropZonePlugin,
    MediaWebsitePlugin,
    SetupEditorPlugin,
];

function onIframeLoaded(iframe, callback) {
    const doc = iframe.contentDocument;
    if (doc.readyState === "complete") {
        callback();
    } else {
        iframe.contentWindow.addEventListener("load", callback, { once: true });
    }
}

export class SnippetsMenu extends Component {
    static template = "html_builder.SnippetsMenu";
    static components = { BlockTab, CustomizeTab };
    static props = {
        iframe: { type: Object },
        closeEditor: { type: Function },
        snippetsName: { type: String },
        websiteId: { type: Number },
    };

    setup() {
        // const actionService = useService("action");
        this.pages = [blockTab, customizeTab];
        this.state = useState({
            canUndo: false,
            canRedo: false,
            activeTab: "blocks",
            selectedToolboxes: undefined,
        });
        useHotkey("control+z", () => this.undo());
        useHotkey("control+y", () => this.redo());
        useHotkey("control+shift+z", () => this.redo());

        this.action = useService("action");

        const editorBus = new EventBus();
        this.editor = new Editor(
            {
                disableFloatingToolbar: true,
                Plugins: [...MAIN_PLUGINS, ...BUILDER_PLUGIN],
                onChange: () => {
                    this.state.canUndo = this.editor.shared.history.canUndo();
                    this.state.canRedo = this.editor.shared.history.canRedo();
                    editorBus.trigger("STEP_ADDED");
                },
                resources: {
                    change_selected_toolboxes_listeners: (selectedToolboxes) => {
                        this.state.selectedToolboxes = selectedToolboxes;
                        this.setTab("customize");
                    },
                },
                getRecordInfo: (editableEl) => {
                    return {
                        resModel: editableEl.dataset["oeModel"],
                        resId: editableEl.dataset["oeId"],
                        field: editableEl.dataset["oeField"],
                        type: editableEl.dataset["oeType"],
                    };
                },
            },
            this.env.services
        );

        this.snippetModel = useState(
            new SnippetModel(this.env.services, {
                websiteId: this.props.websiteId,
                snippetsName: this.props.snippetsName,
            })
        );
        onWillStart(async () => {
            await this.snippetModel.load();
        });

        useSubEnv({
            editor: this.editor,
            editorBus,
        });
        // onMounted(() => {
        //     // actionService.setActionMode("fullscreen");
        // });
        onIframeLoaded(this.props.iframe, () => {
            this.editor.attachTo(this.props.iframe.contentDocument.body.querySelector("#wrapwrap"));
        });
        onWillDestroy(() => {
            this.editor.destroy();
            // actionService.setActionMode("current");
        });
    }

    discard() {
        // TODO: adapt
        this.editor.getContent();
        this.props.closeEditor();
    }

    save() {
        this.action.restore(this.action.currentController.jsId);
        // this.props.closeEditor();

        console.log("todo");
    }

    setTab(tab) {
        this.state.activeTab = tab;
    }

    undo() {
        this.editor.shared.history.undo();
    }

    redo() {
        this.editor.shared.history.redo();
    }
}

registry.category("lazy_components").add("website.SnippetsMenu", SnippetsMenu);
