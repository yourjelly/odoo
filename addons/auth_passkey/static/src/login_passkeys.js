/** @odoo-module **/

import { startAuthentication } from "../lib/simplewebauthn.js"

globalThis.auth_passkey_login = async function() {
    try {
        const serverOptions = await fetch("/auth/passkey/start-auth").then(data => data.json())
        const auth = await startAuthentication(serverOptions)
        const verificationRequest = await fetch("/auth/passkey/verify-auth", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(auth),
        })
        const verification = await verificationRequest.json()
        if(verification.status == "ok") {
            window.location.href = verification.redirect_url
        }
    } catch(e) {
        console.error(e)
    }
}
