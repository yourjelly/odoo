import { Component, onMounted, onWillDestroy, useComponent, useRef, useState } from "@odoo/owl";
import { Editor } from "./editor";
import { Toolbar } from "./main/toolbar/toolbar";

/**
 * @typedef { import("./editor").EditorConfig } EditorConfig
 **/

function copyCssRules(sourceDoc, targetDoc) {
    for (const sheet of sourceDoc.styleSheets) {
        const rules = [];
        for (const r of sheet.cssRules) {
            rules.push(r.cssText);
        }
        const cssRules = rules.join(" ");
        const styleTag = targetDoc.createElement("style");
        styleTag.appendChild(targetDoc.createTextNode(cssRules));
        targetDoc.head.appendChild(styleTag);
    }
}

/**
 * @param {EditorConfig} config
 * @returns Editor
 */
export function useWysiwyg(config = {}) {
    const comp = useComponent();
    const env = comp.env;
    const editor = new Editor(config, env.services);

    onWillDestroy(() => editor.destroy(true));
    return editor;
}

export class Wysiwyg extends Component {
    static template = "html_editor.Wysiwyg";
    static components = { Toolbar };
    static props = {
        editor: Editor,
        class: { type: String, optional: true },
        style: { type: String, optional: true },
        toolbar: { type: Boolean, optional: true },
        iframe: { type: Boolean, optional: true },
        copyCss: { type: Boolean, optional: true },
    };

    setup() {
        this.state = useState({
            showToolbar: false,
        });
        const overlayRef = useRef("localOverlay");
        const contentRef = useRef("content");
        this.editor = this.props.editor;
        this.editor.updateConfig({
            inlineComponentInfo: { app: this.__owl__.app, env: this.env },
            getLocalOverlayContainer: () => overlayRef?.el,
            disableFloatingToolbar: this.props.toolbar,
        });

        onMounted(() => {
            // now that component is mounted, editor is attached to el, and
            // plugins are started, so we can allow the toolbar to be displayed
            this.state.showToolbar = true;
            const el = contentRef.el;
            if (el.tagName === "IFRAME") {
                // grab the inner body instead
                const attachEditor = () => {
                    if (!this.editor.isDestroyed) {
                        if (this.props.copyCss) {
                            copyCssRules(document, el.contentDocument);
                        }
                        const additionalClasses = el.dataset.class?.split(" ");
                        for (const c of additionalClasses) {
                            el.contentDocument.body.classList.add(c);
                        }
                        this.editor.attachTo(el.contentDocument.body);
                    }
                };
                if (el.contentDocument.readyState === "complete") {
                    attachEditor();
                } else {
                    // in firefox, iframe is not immediately available. we need to wait
                    // for it to be ready before mounting editor
                    el.addEventListener(
                        "load",
                        () => {
                            attachEditor();
                            this.render();
                        },
                        { once: true }
                    );
                }
            } else {
                this.editor.attachTo(el);
            }
        });
    }
}
