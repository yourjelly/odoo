import { Plugin } from "@html_editor/plugin";
import { _t } from "@web/core/l10n/translation";
import { FileMediaDialog } from "@html_editor/main/media/media_dialog/file_media_dialog";
import { closestElement } from "@html_editor/utils/dom_traversal";
import { nextLeaf } from "@html_editor/utils/dom_info";
import { isBlock } from "@html_editor/utils/blocks";
import { renderToElement } from "@web/core/utils/render";
import { withSequence } from "@html_editor/utils/resource";

export class FilePlugin extends Plugin {
    static id = "file";
    static dependencies = ["embeddedComponents", "dom", "selection", "history"];
    resources = {
        user_commands: [
            // {
            //     id: "openMediaDialog",
            //     title: _t("File"),
            //     description: _t("Upload a file"),
            //     icon: "fa-file",
            //     isAvailable: (selection) => {
            //         return (
            //             !this.config.disableFile &&
            //             !closestElement(selection.anchorNode, "[data-embedded='clipboard']")
            //         );
            //     },
            //     run: () => {
            //         this.openMediaDialog({
            //             noVideos: true,
            //             noImages: true,
            //             noIcons: true,
            //             noDocuments: true,
            //         });
            //     },
            // },
            {
                id: "uploadFile",
                title: _t("Upload File"),
                description: _t("MY COMMAND upload a file"),
                icon: "fa-upload",
                run: () => this.openFileSelector(),
            },
        ],
        powerbox_items: [
            // {
            //     categoryId: "media",
            //     commandId: "openMediaDialog",
            // },
            {
                categoryId: "media",
                commandId: "uploadFile",
            },
        ],
        power_buttons: withSequence(5, { commandId: "uploadFile" }),
        mount_component_handlers: this.setupNewFile.bind(this),
    };

    setup() {
        const input = this.document.createElement("input");
        input.type = "file";
        // input.accept = "*/*"; // TODO
        // // no multiple // TODO
        this.addDomListener(input, "change", () => {
            if (!input.files.length) {
                console.log("no files selected");
                return;
            }
            const { resModel, resId } = this.recordInfo;
            this.services.upload.uploadFiles(
                input.files,
                { resModel, resId },
                async (attachment) => {
                    const [element] = await this.renderMedia([attachment]);
                    this.insertFileElement(element, { restoreSelection: this.restoreSelection });
                }
            );
            input.value = "";
        });
        this.inputElement = input;
    }

    get recordInfo() {
        return this.config.getRecordInfo ? this.config.getRecordInfo() : {};
    }

    // openMediaDialog(params = {}) {
    //     const selection = this.dependencies.selection.getEditableSelection();
    //     const restoreSelection = () => {
    //         this.dependencies.selection.setSelection(selection);
    //     };
    //     const { resModel, resId, field, type } = this.recordInfo;
    //     this.services.dialog.add(FileMediaDialog, {
    //         resModel,
    //         resId,
    //         useMediaLibrary: !!(
    //             field &&
    //             ((resModel === "ir.ui.view" && field === "arch") || type === "html")
    //         ), // @todo @phoenix: should be removed and moved to config.mediaModalParams
    //         save: (element) => {
    //             this.insertFileElement(element, { restoreSelection });
    //         },
    //         close: restoreSelection,
    //         onAttachmentChange: this.config.onAttachmentChange || (() => {}),
    //         noVideos: !!this.config.disableVideo,
    //         noImages: !!this.config.disableImage,
    //         ...this.config.mediaModalParams,
    //         ...params,
    //     });
    // }

    insertFileElement(element, { restoreSelection }) {
        restoreSelection();
        this.dependencies.dom.insert(element);
        this.dependencies.history.addStep();
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

    openFileSelector() {
        const { restore } = this.dependencies.selection.preserveSelection();
        this.restoreSelection = restore;
        this.inputElement.click();
    }

    /**
     * @override
     * Render the selected media. This needs a custom implementation because
     * the media is rendered as a Behavior blueprint for Knowledge, hence
     * no super call.
     *
     * @param {Object} selectedMedia First element of the selectedMediaArray,
     *                 which has length = 1 in this case because this component
     *                 is meant to be used with the prop `multiSelect = false`
     * @returns {Promise<Array<HTMLElement>>}
     */
    async renderMedia([selectedMedia]) {
        let accessToken = selectedMedia.access_token;
        if (!selectedMedia.public || !accessToken) {
            // Generate an access token so that anyone with read access to the
            // article can view its files.
            [accessToken] = await this.services.orm.call("ir.attachment", "generate_access_token", [
                selectedMedia.id,
            ]);
        }
        const dotSplit = selectedMedia.name.split(".");
        const extension = dotSplit.length > 1 ? dotSplit.pop() : undefined;
        const fileData = {
            access_token: accessToken,
            checksum: selectedMedia.checksum,
            extension,
            filename: selectedMedia.name,
            id: selectedMedia.id,
            mimetype: selectedMedia.mimetype,
            name: selectedMedia.name,
            type: selectedMedia.type,
            url: selectedMedia.url || "",
        };
        const fileBlock = renderToElement("html_editor.EmbeddedFileBlueprint", {
            embeddedProps: JSON.stringify({
                fileData,
            }),
        });
        return [fileBlock];
    }
}
