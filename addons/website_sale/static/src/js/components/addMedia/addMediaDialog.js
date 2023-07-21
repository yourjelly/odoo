/** @odoo-module **/

import { Dialog } from "@web/core/dialog/dialog";
// import { Dialog } from "@web/legacy/js/core/dialog";


class addMediaImage extends Dialog {
    setup() {
        super.setup();
    }
}

addMediaImage.components = { ...Dialog.components, DebugMenu };
addMediaImage.template = xml`
<div>I am media dialog</div>
`;



/**
 * This LegacyAdaptedaddMediaImage class will disappear when legacy code will be entirely rewritten.
 * The "addMediaImage" class should get exported from this file when the cleaning will occur, and it
 * should stop extending Dialog and use it normally instead at that point.
 */
class LegacyAdaptedaddMediaImage extends addMediaImage {
    setup() {
        super.setup();
    }
}
LegacyAdaptedaddMediaImage.template = xml`<div>I am media dialog</div>`;

export { LegacyAdaptedaddMediaImage as addMediaImage };










// export class addMediaDialog extends Dialog {

//     addMediaImage = function (owner, message, options) {
//         /**
//          * Creates an improved callback from the given callback value at the given
//          * key from the parent function's options parameter. This is improved to:
//          *
//          * - Prevent calling given callbacks once one has been called.
//          *
//          * - Re-allow calling callbacks once a previous callback call's returned
//          *   Promise is rejected.
//          */
//         let isBlocked = false;
//         function makeCallback(key) {
//             const callback = options && options[key];
//             return function () {
//                 if (isBlocked) {
//                     // Do not (re)call any callback and return a rejected Promise
//                     // to prevent closing the Dialog.
//                     return Promise.reject();
//                 }
//                 isBlocked = true;
//                 const callbackRes = callback && callback.apply(this, arguments);
//                 Promise.resolve(callbackRes).guardedCatch(() => {
//                     isBlocked = false;
//                 });
//                 return callbackRes;
//             };
//         }
//         var buttons = [
//             {
//                 text: _t("Ok"),
//                 classes: 'btn-primary',
//                 close: true,
//                 click: makeCallback('confirm_callback'),
//             },
//             {
//                 text: _t("Cancel"),
//                 close: true,
//                 click: makeCallback('cancel_callback'),
//             }
//         ];
//         return new Dialog(owner, _.extend({
//             size: 'medium',
//             buttons: buttons,
//             $content: $('<main/>', {
//                 role: 'alert',
//                 text: message,
//             }),
//             title: _t("Confirmation"),
//             onForceClose: options && (options.onForceClose || options.cancel_callback),
//         }, options)).open({shouldFocusButtons:true});
//     };
// }

// var addMediaDialog = new Dialog(this, {
//     title: _t("Select a media"),
//     size: "large",
//     $content: $('<main/>', {
//         text: "Add Image",
//     }),
// }).open();

// import { Dialog } from "@web/core/dialog/dialog";

// export class AddMediaDialog extends Dialog {
//     setup() {
//         super.setup();
//         // this.title = this.props.title;
//     }
// }

// AddMediaDialog.props = {
//     title: 'I am Extra media',
//     body: String,
// }

// AddMediaDialog.template = xml`
//     <div>hi I am add media dialog </div>
// `