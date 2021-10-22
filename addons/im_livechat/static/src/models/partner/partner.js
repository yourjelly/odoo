/** @odoo-module **/

import { patchModelMethods } from '@mail/model/model_core';

// ensure that the model definition is loaded before the patch
import '@mail/models/partner/partner';

let nextPublicId = -1;

patchModelMethods('mail.partner', {

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    getNextPublicId() {
        const id = nextPublicId;
        nextPublicId -= 1;
        return id;
    },
});

