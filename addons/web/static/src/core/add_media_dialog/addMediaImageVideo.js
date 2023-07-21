/** @odoo-module */

import { Dialog } from "../dialog/dialog";
import { _lt } from "../l10n/translation";
import { useService } from "@web/core/utils/hooks";
import weUtils from "@web_editor/js/common/utils";

import { Component, useRef, useState, onWillStart } from "@odoo/owl";

export const IMAGE_MIMETYPES = [
    "image/jpg",
    "image/jpeg",
    "image/jpe",
    "image/png",
    "image/svg+xml",
    "image/gif",
    "image/webp",
];
export const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".jpe", ".png", ".svg", ".gif", ".webp"];

export class AddMediaImageVideo extends Component {
    // static props = {
    //     productTemplateId: { type: Number, optional: true },
    // };

    setup() {
        this.rpc = useService("rpc");
        this.orm = useService("orm");

        this.state = useState({
            attachments: [],
            needle: "",
            canLoadMoreAttachments: true,
            isFetchingAttachments: false,
        });

        this.selectedMedia = useState({});
        this.fileInput = useRef("file-input");
        this.uploadService = useService("upload");
        this.state.searchService = "all";
        this.state.libraryMedia = [];

        this.NUMBER_OF_ATTACHMENTS_TO_DISPLAY = 30;

        onWillStart(async () => {
            this.state.attachments = await this.fetchAttachments(
                this.NUMBER_OF_ATTACHMENTS_TO_DISPLAY,
                0
            );
        });
    }

    get attachmentsDomain() {
        const domain = [
            "&",
            ["res_model", "=", this.props.resModel],
            ["res_id", "=", this.props.resId || 0],
        ];
        domain.unshift("|", ["public", "=", true]);
        domain.push(["name", "ilike", this.state.needle]);
        console.log("this.state.needle: ", this.state.needle);
        domain.push(["mimetype", "in", IMAGE_MIMETYPES]);
        if (!this.props.useMediaLibrary) {
            domain.push("|", ["url", "=", false], "!", ["url", "=ilike", "/web_editor/shape/%"]);
        }
        domain.push("!", ["name", "=like", "%.crop"]);
        domain.push("|", ["type", "=", "binary"], "!", ["url", "=like", "/%/static/%"]);

        // Optimized images (meaning they are related to an `original_id`) can
        // only be shown in debug mode as the toggler to make those images
        // appear is hidden when not in debug mode.
        // There is thus no point to fetch those optimized images outside debug
        // mode. Worst, it leads to bugs: it might fetch only optimized images
        // when clicking on "load more" which will look like it's bugged as no
        // images will appear on screen (they all will be hidden).
        if (!this.env.debug) {
            const subDomain = [false];

            // Particular exception: if the edited image is an optimized
            // image, we need to fetch it too so it's displayed as the
            // selected image when opening the media dialog.
            // We might get a few more optimized image than necessary if the
            // original image has multiple optimized images but it's not a
            // big deal.
            const originalId = this.props.media && this.props.media.dataset.originalId;
            if (originalId) {
                subDomain.push(originalId);
            }

            domain.push(["original_id", "in", subDomain]);
        }
        console.log("domain: ", domain);
        return domain;
    }

    async fetchAttachments(limit, offset) {
        this.state.isFetchingAttachments = true;
        let attachments = [];
        try {
            //  here try this.rpc instead?
            attachments = await this.orm.call("ir.attachment", "search_read", [], {
                domain: this.attachmentsDomain,
                fields: [
                    "name",
                    "mimetype",
                    "description",
                    "checksum",
                    "url",
                    "type",
                    "res_id",
                    "res_model",
                    "public",
                    "access_token",
                    "image_src",
                    "image_width",
                    "image_height",
                    "original_id",
                ],
                order: "id desc",
                // Try to fetch first record of next page just to know whether there is a next page.
                limit,
                offset,
            });
            attachments.forEach((attachment) => (attachment.mediaType = "attachment"));
        } catch (e) {
            // Reading attachments as a portal user is not permitted and will raise
            // an access error so we catch the error silently and don't return any
            // attachment so he can still use the wizard and upload an attachment
            if (e.exceptionName !== "odoo.exceptions.AccessError") {
                throw e;
            }
        }
        this.state.canLoadMoreAttachments =
            attachments.length >= this.NUMBER_OF_ATTACHMENTS_TO_DISPLAY;
        this.state.isFetchingAttachments = false;
        console.log("attachments: ", attachments);
        const primaryColors = {};
        for (let color = 1; color <= 5; color++) {
            primaryColors[color] = weUtils.getCSSVariableValue("o-color-" + color);
        }
        return attachments.map((attachment) => {
            if (attachment.image_src) {
                if (attachment.image_src.startsWith("/")) {
                    const newURL = new URL(attachment.image_src, window.location.origin);
                    // Set the main colors of dynamic SVGs to o-color-1~5
                    if (attachment.image_src.startsWith("/web_editor/shape/")) {
                        newURL.searchParams.forEach((value, key) => {
                            const match = key.match(/^c([1-5])$/);
                            if (match) {
                                newURL.searchParams.set(key, primaryColors[match[1]]);
                            }
                        });
                    } else {
                        // Set height so that db images load faster
                        newURL.searchParams.set("height", 2 * this.MIN_ROW_HEIGHT);
                    }
                    attachment.thumbnail_src = newURL.pathname + newURL.search;
                }
            }
            // if (this.selectInitialMedia() && this.isInitialMedia(attachment)) {
            //     this.selectAttachment(attachment);
            // }
            console.log("img_selector attachments: ", attachments);
            return attachment;
        });
    }

    async onImageLoaded() {
        if (!this.image.el) {
            // Do not fail if already removed.
            return;
        }
        if (this.props.onLoaded) {
            await this.props.onLoaded(this.image.el);
            if (!this.image.el) {
                // If replaced by colored version, aspect ratio will be
                // computed on it instead.
                return;
            }
        }
        const aspectRatio = this.image.el.offsetWidth / this.image.el.offsetHeight;
        const width = aspectRatio * this.props.minRowHeight;
        this.container.el.style.flexGrow = width;
        this.container.el.style.flexBasis = `${width}px`;
        this.state.loaded = true;
    }

    onClickUpload() {
        // $('.imgUpload').trigger('click');
        this.fileInput.el.click();
    }

    async onChangeFileInput() {
        console.log("changes detected");
        const inputFiles = this.fileInput.el.files;
        if (!inputFiles.length) {
            return;
        }
        await this.uploadFiles(inputFiles);
        this.fileInput.el.value = "";
    }

    async onUploaded(attachment) {
        console.log("attachment", attachment);
        this.state.attachments = [attachment, ...this.state.attachments];
        this.selectAttachment(attachment);
        if (!this.props.multiSelect) {
            await this.save();
        }
        if (this.props.onAttachmentChange) {
            this.props.onAttachmentChange(attachment);
        }
    }

    selectAttachment(attachment) {
        console.log(this.props);
        this.selectMedia({ ...attachment, mediaType: "attachment" });
    }

    selectMedia(media, tabId, multiSelect) {
        if (multiSelect) {
            const isMediaSelected = this.selectedMedia[tabId]
                .map(({ id }) => id)
                .includes(media.id);
            if (!isMediaSelected) {
                this.selectedMedia[tabId].push(media);
            } else {
                this.selectedMedia[tabId] = this.selectedMedia[tabId].filter(
                    (m) => m.id !== media.id
                );
            }
        } else {
            this.selectedMedia[tabId] = [media];
        }
    }

    async save() {}

    async uploadFiles(files) {
        await this.uploadService.uploadFiles(
            files,
            { resModel: this.props.resModel, resId: this.props.resId },
            (attachment) => this.onUploaded(attachment)
        );
    }

    get hasContent() {
        if (this.state.searchService === "all") {
            return super.hasContent || !!this.state.libraryMedia.length;
        } else if (this.state.searchService === "media-library") {
            return !!this.state.libraryMedia.length;
        }
        return super.hasContent;
    }

    get isFetching() {
        return super.isFetching || this.state.isFetchingLibrary;
    }

    async _discard() {
        // TODO: on discard changes
    }
}

AddMediaImageVideo.template = "web.AddMediaImageVideo";
AddMediaImageVideo.components = { Dialog };
// AutoResizeImageShop
AddMediaImageVideo.defaultProps = {
    addLabel: _lt("ADD"),
    discardLabel: _lt("Discard"),
    title: _lt("Select a media"),
};
