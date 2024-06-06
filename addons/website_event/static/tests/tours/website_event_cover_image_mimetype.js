/** @odoo-module **/

import wTourUtils from "@website/js/tours/tour_utils";
import {
    mockCanvasToDataURLStep,
    uploadImageFromDialog
} from "@website/../tests/tours/snippet_image_mimetype";

const DUMMY_PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQIW2NgAAIAAAUAAR4f7BQAAAAASUVORK5CYII=";

// TODO run tests
function testPngUploadImplicitConversion(expectedMimetype) {
    return [
        {
            content: "Click on the first event's cover",
            trigger: "iframe .o_record_cover_component",
        },
        {
            content: "Open add image dialog",
            trigger: '.snippet-option-CoverProperties we-button[data-bs-original-title="Image"]',
        },
        ...uploadImageFromDialog(
            "image/png",
            "fake_file.png",
            DUMMY_PNG,
            ".o_record_has_cover .o_b64_image_to_save", // TODO find a better way to wait for image to load
        ),
        ...wTourUtils.clickOnSave(),
        {
            content: `Verify image mimetype is ${expectedMimetype}`,
            trigger: "iframe .o_record_cover_component",
            async run() {
                const cover = this.$anchor[0];

                async function convertToBase64(file) {
                    return await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });
                }

                const src = cover.style.backgroundImage.split('"')[1];
                const imgBlob = await (await fetch(src)).blob();
                const dataURL = await convertToBase64(imgBlob);
                const mimetype = dataURL.split(':')[1].split(';')[0];
                if (mimetype !== expectedMimetype) {
                    console.error(`Wrong mimetype ${mimetype} - Expected ${expectedMimetype}`);
                }
            }
        },
    ];
}

wTourUtils.registerWebsitePreviewTour("website_event_cover_image_mimetype", {
    test: true,
    edition: true,
    url: "/event",
}, () => [
    ...testPngUploadImplicitConversion("image/webp"),
]);

wTourUtils.registerWebsitePreviewTour("website_event_cover_image_mimetype_no_webp", {
    test: true,
    edition: true,
    url: "/event",
}, () => [
    mockCanvasToDataURLStep,
    ...testPngUploadImplicitConversion("image/png"),
]);
