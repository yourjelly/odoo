import { Plugin } from "@html_editor/plugin";
import { _t } from "@web/core/l10n/translation";
import { FileMediaDialog } from "@html_editor/main/media/media_dialog/file_media_dialog";
import { closestElement } from "@html_editor/utils/dom_traversal";
import { nextLeaf } from "@html_editor/utils/dom_info";
import { isBlock } from "@html_editor/utils/blocks";

export class FilePlugin extends Plugin {
    static name = "file";
    static dependencies = ["embeddedComponents", "dom", "selection", "history"];
    resources = {
        user_commands: [
            {
                id: "openMediaDialog",
                label: _t("File"),
                description: _t("Upload a file"),
                icon: "fa-file",
                isAvailable: (node) => {
                    return (
                        !this.config.disableFile &&
                        !!closestElement(node, "[data-embedded='clipboard']")
                    );
                },
                run: () => {
                    this.openMediaDialog({
                        noVideos: true,
                        noImages: true,
                        noIcons: true,
                        noDocuments: true,
                    });
                },
            },
        ],
        powerboxItems: [
            {
                category: "media",
                commandId: "openMediaDialog",
            },
        ],
        mount_component_handlers: this.setupNewFile.bind(this),
    };

    get recordInfo() {
        return this.config.getRecordInfo ? this.config.getRecordInfo() : {};
    }

    openMediaDialog(params = {}) {
        const selection = this.shared.getEditableSelection();
        const restoreSelection = () => {
            this.shared.setSelection(selection);
        };
        const { resModel, resId, field, type } = this.recordInfo;
        this.services.dialog.add(FileMediaDialog, {
            resModel,
            resId,
            useMediaLibrary: !!(
                field &&
                ((resModel === "ir.ui.view" && field === "arch") || type === "html")
            ), // @todo @phoenix: should be removed and moved to config.mediaModalParams
            save: (element) => {
                this.onSaveMediaDialog(element, { restoreSelection });
            },
            close: restoreSelection,
            onAttachmentChange: this.config.onAttachmentChange || (() => {}),
            noVideos: !!this.config.disableVideo,
            noImages: !!this.config.disableImage,
            ...this.config.mediaModalParams,
            ...params,
        });
    }

    onSaveMediaDialog(element, { restoreSelection }) {
        restoreSelection();
        this.shared.domInsert(element);
        this.shared.addStep();
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
                                this.shared.setSelection({
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
}
