/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { ImageSelector } from '@web_editor/components/media_dialog/image_selector';
import { ImageSelector as HtmlImageSelector } from "@html_editor/main/media/media_dialog/image_selector";
import { FileDocumentsSelector } from "@html_editor/others/embedded_components/file/file_media_dialog/file_documents_selector";

patch(ImageSelector.prototype, {
    get attachmentsDomain() {
        const domain = super.attachmentsDomain;
        domain.push('|', ['url', '=', false], '!', ['url', '=like', '/web/image/website.%']);
        domain.push(['key', '=', false]);
        return domain;
    }
});

patch(HtmlImageSelector.prototype, {
    get attachmentsDomain() {
        const domain = super.attachmentsDomain;
        domain.push('|', ['url', '=', false], '!', ['url', '=like', '/web/image/website.%']);
        domain.push(['key', '=', false]);
        return domain;
    }
});

// TODO ABD: is this patch applied if in a module which is not dependent on website ?
patch(FileDocumentsSelector.prototype, {
    get attachmentsDomain() {
        const domain = super.attachmentsDomain;
        domain.push("|", ["url", "=", false], "!", ["url", "=like", "/web/image/website.%"]);
        domain.push(["key", "=", false]);
        return domain;
    },
});
