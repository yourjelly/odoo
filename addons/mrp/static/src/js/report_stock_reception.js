/** @odoo-module alias=mrp.ReceptionReport **/

import ReceptionReport from 'stock.ReceptionReport';

ReceptionReport.include({

    /**
     * @override
     */
     _onClickPrintLabel: function(ev) {
        return this._super(ev).then(() => {
            return this._printLabel(ev, 'mrp.report_reception_report_label_mrp', 'mrp.production')
        });
    },

});
