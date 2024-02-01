/** @odoo-module **/

import { registry } from "@web/core/registry";
import { formView } from "@web/views/form/form_view";
import { FormController } from "@web/views/form/form_controller";
import { X2ManyFieldDialog } from "@web/views/fields/relational_utils";
import { patch } from "@web/core/utils/patch";
import { useService } from "@web/core/utils/hooks";
import { startAuth } from "@webauthn/webauthn_key"

export class WebauthnHRFormController extends FormController {
    #unpatch

    setup() {
        this.#unpatch?.()
        this.#unpatch = patch(X2ManyFieldDialog.prototype, {
            async save() {
                if( this.record.data.public_key == "" &&
                    await this.record.checkValidity({ displayNotification: true })
                ) {
                    try {
                        let registration = await startAuth()
                        this.record._changes.credential_identifier = registration.credentialId
                        this.record._changes.public_key = registration.credentialPublicKey
                    } catch(e) {
                        console.error(e)
                        this.discard(...arguments)
                        return false
                    }
                }
                super.save(...arguments)
            }
        })
        super.setup()
        this.action = useService("action");
        this.mustReload = false;
    }

    onWillSaveRecord(record, changes) {
        this.mustReload = "lang" in changes;
    }

    async onRecordSaved(record) {
        await super.onRecordSaved(...arguments);
        if (this.mustReload) {
            this.mustReload = false;
            return this.action.doAction("reload_context");
        }
    }

    async beforeLeave() {
        this.#unpatch?.()
        return super.beforeLeave()
    }
}

registry.category("views").add("webauthn_insert_creds_form_hr", {
    ...formView,
    Controller: WebauthnHRFormController,
})
