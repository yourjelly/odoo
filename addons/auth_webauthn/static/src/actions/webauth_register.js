/** @odoo-module **/
import { registry } from "@web/core/registry";

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
function bufferToBase64URLString(buffer) {
    const bytes = new Uint8Array(buffer);
    let str = '';

    for (const charCode of bytes) {
        str += String.fromCharCode(charCode);
    }

    const base64String = btoa(str);

    return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

}
function isWebauthnSupported() {
    return window.PublicKeyCredential !== undefined && typeof window.PublicKeyCredential === "function";
}

export function webauthnRegisterBegin(env, action) {
    if (!isWebauthnSupported()) {
        // TODO: UserError
        console.error("WebAuthn is not supported by this browser.");
        return;
    }

    let options = JSON.parse(action.params.options);
    options.rp.id = options.rp.id.split(':')[0];

    if (options.rp.id.split(':')[0] != window.location.hostname) {
        // TODO: UserError
        console.error("WebAuthn hostname does not match current hostname.");
    }

    options.challenge = base64URLStringToBuffer(options.challenge);
    options.user.id = new TextEncoder().encode(options.user.id);

    console.log(options);

    navigator.credentials.create({ publicKey: options })
        .then((newCredentialInfo) => {
            if (!newCredentialInfo) {
                // TODO: UserError
                console.error("WebAuthn couldn't create credentials.");
            }

            const { id, rawId, response, type } = newCredentialInfo;
            let transport, responsePublicKey, responsePublicKeyAlgorithm, responseAuthenticatorData;

            if (typeof response.getTransports === 'function') {
                transport = response.getTransports();
            }

            if (typeof response.getPublicKeyAlgorithm === 'function') {
                try {
                    responsePublicKeyAlgorithm = response.getPublicKeyAlgorithm();
                } catch (e) {
                    // TODO: UserError
                    console.error(`Webauthn: getPublicKeyAlgorithm() is not properly supported by this browser: ${e}`);
                }
            }

            if (typeof response.getPublicKey === 'function') {
                try {
                    let _publicKey = response.getPublicKey();
                    if (_publicKey !== null) {
                        responsePublicKey = bufferToBase64URLString(_publicKey);
                    }
                } catch (e) {
                    // TODO: UserError
                    console.error(`Webauthn: getPublicKeyAlgorithm() is not properly supported by this browser: ${e}`);
                    return;
                }
            }

            if (typeof response.getAuthenticatorData === 'function') {
                try {
                    responseAuthenticatorData = bufferToBase64URLString(response.getAuthenticatorData());
                } catch (e) {
                    // TODO: UserError
                    console.error(`Webauthn: getAuthenticatorData() is not properly supported by this browser: ${e}`);
                }
            }

            let ret = JSON.stringify({
                id,
                rawId: bufferToBase64URLString(rawId),
                response: {
                    attestationObject: bufferToBase64URLString(response.attestationObject),
                    clientDataJSON: bufferToBase64URLString(response.clientDataJSON),
                    transport,
                    publicKeyAlgorithm: responsePublicKeyAlgorithm,
                    publicKey: responsePublicKey,
                    authenticatorData: responseAuthenticatorData,
                },
                type,
                clientExtensionResults: newCredentialInfo.getClientExtensionResults(),
                authenticatorAttachment: toAuthenticatorAttachment(newCredentialInfo.authenticatorAttachment),
            });

            env.services.orm.call("auth_webauthn.wizard", "verifyAttestation", [ret])
        })
        .catch((err) => {
            // TODO: UserError
            console.error(`Webauthn couldn't create credentials: ${err}`);
        });
}

registry.category("actions").add("webauthn_register_begin", webauthnRegisterBegin);