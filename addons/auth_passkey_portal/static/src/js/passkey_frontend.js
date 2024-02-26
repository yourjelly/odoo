/** @odoo-module **/

import { _t } from "@web/core/l10n/translation";
import { handleCheckIdentity } from "@portal/js/portal_security";
import publicWidget from "@web/legacy/js/public/public_widget";
import { session } from "@web/session";

function base64ToArrayBuffer(base64) {
    var binaryString = atob(base64);
    var bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

publicWidget.registry.passkeyLoginButton = publicWidget.Widget.extend({
    selector: '#auth_passkey_login',
    events: {
        click: '_onClick',
    },
    init() {
        this._super(...arguments);
        this.enableIfAvailable();
        this.http = this.bindService('http');
    },
    async enableIfAvailable() {
        if (window.PublicKeyCredential && PublicKeyCredential.isConditionalMediationAvailable) {
            const isCMA = await PublicKeyCredential.isConditionalMediationAvailable();
            if (isCMA) {
                this.el.disabled = false;
            }
        }
    },
    async _onClick(e) {
        const abortController = new AbortController();
        const challenge = (Math.random() + 1).toString(36).substring(2); // This challenge should come from the server
        const challenge_bytes = (new TextEncoder()).encode(challenge);
        const rpId =  window.location.hostname; // this should be the current domain?
        const options = {
            challenge: challenge_bytes,
            rpId: rpId,
            userVerification: "required",
        };
        const cred = await navigator.credentials.get({
            publicKey: options,
            signal: abortController.signal,
            mediation: 'required',
        });
        // console.log(cred);
        const params = {
            csrf_token: odoo.csrf_token,
            cred: JSON.stringify(cred),
            redirect: '/web',  // should be the original url
            ex_challenge: challenge,
            ex_rpId: rpId,
            ex_origin: 'https://' + rpId,
            cr_pub_key: '',
            cr_sign_cnt: 0,
            require_user_verif: true,
        };
        // const verification = await this.http.post('/auth_passkey/signin', params, "text")
        // debugger;
        const formData = new FormData();
        for (const key in params) {
            const value = params[key];
            if (Array.isArray(value) && value.length) {
                for (const val of value) {
                    formData.append(key, val);
                }
            } else {
                formData.append(key, value);
            }
        }
        const verification = await fetch('/auth_passkey/signin', {
            method: 'POST',
            body: formData,
            redirect: 'follow',
            // mode: "cors",
            credentials: "include",
            // origin: 'https://391d-2a02-a03f-a88f-7b00-211e-d3d9-c09f-c40c.ngrok-free.app',
        });
        // console.log(verification);
        window.location.href = verification.url;
    },
});

publicWidget.registry.EnablePasskeyButton = publicWidget.Widget.extend({
    selector: '#auth_passkey_portal_enable',
    events: {
        click: '_onClick',
    },

    init() {
        this._super(...arguments);
        this.enableIfAvailable();
        this.orm = this.bindService("orm");
        this.dialog = this.bindService("dialog");
    },

    enableIfAvailable() {
        if (
            window.PublicKeyCredential
            && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
            && PublicKeyCredential.isConditionalMediationAvailable
           ) {
            Promise.all([
                PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
                PublicKeyCredential.isConditionalMediationAvailable(),
            ]).then( results => {
                if (results.every(r => r === true)) {
                    console.log('Passkeys are supported', results);
                    this.el.disabled = false;
                }
            });
        }
    },

    async _onClick(e) {
        e.preventDefault();

        const options = await handleCheckIdentity(
            this.orm.call("res.users", "get_passkey_credential_options", [session.user_id]),
            this.orm,
            this.dialog
        );
        const origChallenge = options.challenge;
        // console.log(options);
        // console.log(origChallenge)
        options.challenge = base64ToArrayBuffer(origChallenge);
        options.user.id = base64ToArrayBuffer(options.user.id);
        navigator.credentials.create({ publicKey: options }).then(async (r) => {
            // console.log(r);
            const cred = await this.orm.call("res.users", "save_passkey_credential", [session.user_id], {credential: r, ex_options: {challenge: origChallenge, rp_id: options['rp']['id']}});
            console.log(cred);
        });
    },
});
