/* @odoo-module */
import { makeEnv, startServices } from "@web/env";
import { session } from "@web/session";
import { useService } from "@web/core/utils/hooks";

// Credit: https://github.com/MasterKale/SimpleWebAuthn/
function bufferToBase64URLString(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';

    for (const charCode of bytes) {
        str += String.fromCharCode(charCode);
    }

    const base64String = btoa(str);

    return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

}

// Credit: https://github.com/MasterKale/SimpleWebAuthn/
function toAuthenticatorAttachment(attachment) {
    const attachments = ['cross-platform', 'platform'];
    if (!attachment) {
        return;
    }

    if (attachments.indexOf(attachment) < 0) {
        return;
    }

    return attachment;
}


// Credit: https://github.com/MasterKale/SimpleWebAuthn/
function base64URLStringToBuffer(base64URLString) {
    // Convert from Base64URL to Base64
    const base64 = base64URLString.replace(/-/g, '+').replace(/_/g, '/');
    /**
     * Pad with '=' until it's a multiple of four
     * (4 - (85 % 4 = 1) = 3) % 4 = 3 padding
     * (4 - (86 % 4 = 2) = 2) % 4 = 2 padding
     * (4 - (87 % 4 = 3) = 1) % 4 = 1 padding
     * (4 - (88 % 4 = 0) = 4) % 4 = 0 padding
     */
    const padLength = (4 - (base64.length % 4)) % 4;
    const padded = base64.padEnd(base64.length + padLength, '=');

    // Convert to a binary string
    const binary = atob(padded);

    // Convert binary string to buffer
    const buffer = new ArrayBuffer(binary.length);
    const bytes = new Uint8Array(buffer);

    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }

    return buffer;
}

async function webauthn_get_challenge() {
    const response = await fetch('/web/login/webauthn/challenge', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
    });
    const data = await response.json();
    return JSON.parse(data.result);
}

async function init_env() {
    return env;
}

(async function setup() {
    let options = await webauthn_get_challenge();
    if (options.allowCredentials.length === 0) {
        console.error("No credentials registered.");
        return;
    }

    options.challenge = base64URLStringToBuffer(options.challenge);
    options.rpId = options.rpId.split(':')[0];

    options.allowCredentials.forEach((credential) => {
        credential.id = base64URLStringToBuffer(credential.id);
    });

    let creds = await navigator.credentials.get({ publicKey: options });

    const { id, rawId, response, type } = creds;
    let userHandle = undefined;
    if (response.userHandle) {
        userHandle = new TextDecoder('utf-8').decode(response.userHandle);
    }


    let ret = JSON.stringify({
        id,
        rawId: bufferToBase64URLString(rawId),
        response: {
            authenticatorData: bufferToBase64URLString(response.authenticatorData),
            clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
            signature: bufferToBase64URLString(response.signature),
            userHandle,
        },
        type,
        clientExtensionResults: creds.getClientExtensionResults(),
        authenticatorAttachment: toAuthenticatorAttachment(
            creds.authenticatorAttachment,
        ),
    });

    let payload = encodeURIComponent(ret);
    window.location.href = "/web/login/webauthn/verify/" + payload;
})();