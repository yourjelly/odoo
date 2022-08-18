/** @odoo-module **/

import {FieldChar} from 'web.basic_fields';
import fieldRegistry from 'web.field_registry';

var SmsSubjectWidget = FieldChar.extend({
    /**
     * @override
     */
    openDynamicPlaceholder: async function (baseModel, chain = []) {
        // We don't want dynamic ploaceholder in sms sujects
        // as they are juste an internal field that is never send.
        if(this.recordData && this.recordData.mailing_type !== 'sms') {
            this._super.apply(this, arguments);
        }
    },
});

fieldRegistry.add('sms_subject_widget', SmsSubjectWidget);

export default SmsSubjectWidget;
