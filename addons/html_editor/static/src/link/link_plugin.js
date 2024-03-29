import { _t } from "@web/core/l10n/translation";
import { Plugin } from "../plugin";
import { closestElement } from "../utils/dom_traversal";
import { LinkPopover } from "./link";
import { reactive } from "@odoo/owl";

function isLinkActive(editable) {
    const selection = editable.ownerDocument.getSelection();
    const linkElement = closestElement(selection.anchorNode, "A");
    return linkElement;
}

export class LinkPlugin extends Plugin {
    static name = "link";
    static dependencies = ["selection", "overlay"];
    static shared = [];
    static resources = (p) => ({
        toolbarGroup: {
            id: "link",
            sequence: 40,
            buttons: [
                {
                    id: "link",
                    cmd: "CREATE_LINK_ON_SELECTION",
                    cmdPayload: { options: { editing: true } },
                    icon: "fa-link",
                    name: "link",
                    label: _t("Link"),
                    isFormatApplied: isLinkActive,
                },
            ],
        },
        powerboxCategory: { id: "navigation", name: _t("Navigation"), sequence: 40 },
        powerboxCommands: [
            {
                name: _t("Link"),
                description: _t("Add a link"),
                category: "navigation",
                fontawesome: "fa-link",
                action(dispatch) {
                    dispatch("TOGGLE_LINK", { options: { forceDialog: true } });
                },
            },
            {
                name: _t("Button"),
                description: _t("Add a button"),
                category: "navigation",
                fontawesome: "fa-link",
                action(dispatch) {
                    dispatch("TOGGLE_LINK", { options: { forceDialog: true } });
                },
            },
        ],
        onSelectionChange: p.handleSelectionChange.bind(p),
    });
    setup() {
        this.linkState = reactive({ linkElement: null });
        this.overlay = this.shared.createOverlay(LinkPopover, {
            dispatch: this.dispatch,
            el: this.editable,
            offset: () => 0,
            linkState: this.linkState,
        });
        this.addDomListener(this.editable, "click", (ev) => {
            if (ev.target.tagName === "A") {
                ev.preventDefault();
                this.toggleLinkTools({ link: ev.target });
            }
        });
    }

    handleCommand(command, payload) {
        switch (command) {
            case "CREATE_LINK_ON_SELECTION":
                this.toggleLinkTools(payload.options);
                break;

            case "TOGGLE_LINK":
                this.toggleLinkTools(payload.options);
                break;
            case "NORMALIZE": {
                this.normalizeLink(payload.node);
                break;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Commands
    // -------------------------------------------------------------------------

    /**
     * Toggle the Link popover to edit links
     *
     */
    toggleLinkTools(options = {}) {
        const selection = this.shared.getEditableSelection();
        const linkElement = closestElement(selection.anchorNode, "A");
        this.linkState.linkElement = linkElement;
    }

    normalizeLink(root = this.editable) {
        // do the sanitizing here
    }

    handleSelectionChange() {
        const sel = this.shared.getEditableSelection();
        const linkel = closestElement(sel.anchorNode, "A");
        if (!linkel) {
            this.overlay.close();
        }
        if (linkel && linkel !== this.linkState.linkElement) {
            this.overlay.close();
            this.linkState.linkElement = linkel;
            this.overlay.open();
        }
        if (linkel && !this.overlay.isOpen) {
            this.overlay.open();
        }
    }

    /**
     * Open the link tools or the image link tool depending on the selection.
     */
    openLinkToolsFromSelection() {
        this.toggleLinkTools();
    }
}
