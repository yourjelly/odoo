/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

import { Component } from "@odoo/owl";
import { startRegistration } from "../lib/simplewebauthn.js"

export class CreatePasskeyButton extends Component {

    setup() {
        this.orm = useService("orm")
        this.notification = useService("notification")
        this.dialogService = useService("dialog")
        this.actionService = useService("action")
        this.title = _t('Create a new Passkey')
    }

    async createNewPasskey() {
        const name = this.props.record.data.name
        if(name.length == 0) {
            this.notification.add(_t("The Passkey needs a name"), {
                title: _t("Error"),
                type: "danger",
            })
            return
        }
        try {
            const registration = await this.register()
            this.orm.call("auth.passkey.key", "action_new_passkey", [{
                "name": name,
                "credential_identifier": registration.credentialId,
                "public_key": registration.credentialPublicKey,
            }])
            this.dialogService.closeAll()
            this.actionService.doAction({
                type: "ir.actions.client",
                tag: "soft_reload",
            })
        } catch (e) {
            console.error(e)
            this.notification.add(_t("Something went wrong adding the Passkey"), {
                title: _t("Error"),
            })
            this.dialogService.closeAll()
        }
    }

    async register() {
        const serverOptions = await fetch("/auth/passkey/start-registration").then(data => data.json())
        const registration = await startRegistration(serverOptions)
    
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
}

export const createPasskeyButton = {
    component: CreatePasskeyButton,
}

CreatePasskeyButton.template = "auth_passkey.CreatePasskeyButton";
registry.category('view_widgets').add('create_passkey_button', createPasskeyButton);
