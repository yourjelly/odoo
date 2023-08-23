/** @odoo-module */

import { ClosePosPopup } from "@point_of_sale/app/navbar/closing_popup/closing_popup";
import { patch } from "@web/core/utils/patch";

patch(ClosePosPopup.prototype, "l10n_pt_pos.ClosePosPopup", {
    async closeSession() {
        const _super = this._super;
        if (this.pos.isPortugueseCountry()) {
            await this.pos.l10nPtPosComputeMissingHashes();
        }
        return _super(...arguments);
    },
});
