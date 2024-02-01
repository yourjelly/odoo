/** @odoo-module **/

import { registry } from "@web/core/registry";
import { formView } from "@web/views/form/form_view";
import { FormController } from "@web/views/form/form_controller";
import { X2ManyFieldDialog } from "@web/views/fields/relational_utils";
import { patch } from "@web/core/utils/patch";

export async function startAuth() {
    const serverOptions = await fetch("/auth/passkey/start-registration").then(data => data.json())
    const registration = await SimpleWebAuthnBrowser.startRegistration(serverOptions)

    const verificationRequest = await fetch("/auth/passkey/verify-registration", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(registration),
    })
    const verification = await (verificationRequest).json()
    
    return verification
}

export class WebauthnFormController extends FormController {
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
    }

    async beforeLeave() {
        this.#unpatch?.()
        return super.beforeLeave()
    }
}

registry.category("views").add("webauthn_insert_creds_form", {
    ...formView,
    Controller: WebauthnFormController,
})
