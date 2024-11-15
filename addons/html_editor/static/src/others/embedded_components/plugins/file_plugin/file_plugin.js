import { Plugin } from "@html_editor/plugin";
import { _t } from "@web/core/l10n/translation";
import { closestElement } from "@html_editor/utils/dom_traversal";
import { isZWS, nextLeaf } from "@html_editor/utils/dom_info";
import { isBlock } from "@html_editor/utils/blocks";
import { renderToElement } from "@web/core/utils/render";
import { withSequence } from "@html_editor/utils/resource";
import { callbacksForCursorUpdate } from "@html_editor/utils/selection";

export class FilePlugin extends Plugin {
    static id = "file";
    static dependencies = ["embeddedComponents", "dom", "selection", "history"];
    resources = {
        user_commands: [
            {
                id: "uploadFile",
                title: _t("File Download"),
                description: _t("Upload a file to download"),
                icon: "fa-upload",
                run: () => this.uploadLocalFiles(),
                isAvailable: ({ anchorNode }) =>
                    !this.config.disableFile &&
                    // @todo: shouldn't it be disabled for any embedded component?
                    !closestElement(anchorNode, "[data-embedded='clipboard']"),
            },
        ],
        powerbox_items: {
            categoryId: "media",
            commandId: "uploadFile",
        },
        power_buttons: withSequence(5, { commandId: "uploadFile" }),
        mount_component_handlers: this.setupNewFile.bind(this),
        normalize_handlers: this.padFileElementsWithZWS.bind(this),
        intangible_char_for_keyboard_navigation_predicates: (_, char) => char === "\u200b",
    };

    /**
     * @param {Object} options
     * @param {boolean} [options.multiple=true] Allow multiple files to be selected
     * @param {string} [options.accept] Accepted file types (accept attribute of input[type=file])
     */
    async uploadLocalFiles({ multiple = true, accept = "*/*" } = {}) {
        const files = await this.selectLocalFiles({ multiple, accept });
        if (!files.length) {
            return;
        }
        const attachments = await this.createAttachments(files);
        const fileElements = await Promise.all(
            attachments.map((attachment) => this.renderMedia(attachment))
        );
        fileElements.forEach((element) => this.dependencies.dom.insert(element));
        this.dependencies.history.addStep();
    }

    /**
     * @param {Object} [options]
     * @param {boolean} [options.multiple=false]
     * @returns {Promise<FileList>}
     */
    async selectLocalFiles({ multiple, accept }) {
        const input = this.document.createElement("input");
        input.type = "file";
        input.multiple = multiple;
        input.accept = accept;
        // other params ?...

        // Open file selector
        const { restore: restoreSelection } = this.dependencies.selection.preserveSelection();
        input.click();

        // Wait for user to select a file or cancel.
        await new Promise((resolve) => {
            const resolveAndClear = () => {
                resolve();
                input.removeEventListener("change", resolveAndClear);
                this.editable.removeEventListener("focus", resolveAndClear);
            };
            // Detect file selected
            input.addEventListener("change", resolveAndClear);
            // Detect file selector closed without selecting file
            this.editable.addEventListener("focus", resolveAndClear);
        });

        // @todo: handle dom changes in between
        restoreSelection();
        return input.files;
    }

    async createAttachments(files) {
        const { resModel, resId } = this.recordInfo;
        const attachments = [];
        // @todo: handler errors
        await this.services.upload.uploadFiles(files, { resModel, resId }, (attachment) => {
            attachments.push(attachment);
            this.config.onAttachmentChange?.(attachment);
        });
        return attachments;
    }

    /**
     * @todo wrap zws in span with class or data-att and remove it on clean for save?
     *
     * Make sure that file elements have a ZWS before and after them, to allow
     * the user to navigate around them with the keyboard.
     *
     * @param {HTMLElement} root
     */
    padFileElementsWithZWS(root) {
        const cursors = this.dependencies.selection.preserveSelection();
        const padWithZWS = (element, position) => {
            const zws = this.document.createTextNode("\u200b");
            cursors.update(callbacksForCursorUpdate[position](element, zws));
            element[position](zws);
        };
        for (const fileElement of root.querySelectorAll("[data-embedded='file']")) {
            if (!isZWS(fileElement.previousSibling)) {
                padWithZWS(fileElement, "before");
            }
            if (!isZWS(fileElement.nextSibling)) {
                padWithZWS(fileElement, "after");
            }
        }
        cursors.restore();
    }

    get recordInfo() {
        return this.config.getRecordInfo ? this.config.getRecordInfo() : {};
    }

    setupNewFile({ name, env }) {
        if (name === "file") {
            Object.assign(env, {
                editorShared: {
                    setSelectionAfter: (host) => {
                        try {
                            const leaf = nextLeaf(host, this.editable);
                            if (!leaf) {
                                return;
                            }
                            const leafEl = isBlock(leaf) ? leaf : leaf.parentElement;
                            if (isBlock(leafEl) && leafEl.isContentEditable) {
                                this.dependencies.selection.setSelection({
                                    anchorNode: leafEl,
                                    anchorOffset: 0,
                                });
                            }
                        } catch {
                            return;
                        }
                    },
                },
            });
        }
    }

    /**
     * @todo: this method should take a list of attachments and render them all
     * making a single call to the server to generate access tokens for each of
     * them
     *
     * @param {Object} attachment
     * @returns {Promise<HTMLElement>}
     */
    async renderMedia(attachment) {
        let accessToken = attachment.access_token;
        if (!attachment.public || !accessToken) {
            // Generate an access token so that anyone with read access to the
            // article can view its files.
            [accessToken] = await this.services.orm.call("ir.attachment", "generate_access_token", [
                attachment.id,
            ]);
        }
        const dotSplit = attachment.name.split(".");
        const extension = dotSplit.length > 1 ? dotSplit.pop() : undefined;
        const fileData = {
            access_token: accessToken,
            checksum: attachment.checksum,
            extension,
            filename: attachment.name,
            id: attachment.id,
            mimetype: attachment.mimetype,
            name: attachment.name,
            type: attachment.type,
            url: attachment.url || "",
        };
        const fileBlock = renderToElement("html_editor.EmbeddedFileBlueprint", {
            embeddedProps: JSON.stringify({ fileData }),
        });
        return fileBlock;
    }
}
