odoo.define('website.ReCaptchaV3', function (require) {
"use strict";

const ajax = require('web.ajax');
const Class = require('web.Class');
const core = require('web.core');

const qweb = core.qweb;

const ReCaptcha = Class.extend({
    /**
     * @override
     */
    init: function () {
        this._publicKey = odoo.reCaptchaPublicKey;
    },
    /**
     * To call and wait for in willStart.
     * @returns {Promise|boolean} true if the libs are loaded else false if the public key is not set.
     */
    waitForLibs: function () {
        if (this._publicKey) {
            const proms = [];
            proms.push(ajax.loadXML('/website/static/src/xml/website.re_captcha.xml', qweb));
            proms.push(ajax.loadJS(`https://www.recaptcha.net/recaptcha/api.js?render=${this._publicKey}`)
            .then(() => new Promise(resolve => window.grecaptcha.ready(() => resolve()))));
            return Promise.all(proms).then(() => {
                return true;
            });
        }
        return false;
    },
    /**
     * Adds the required recaptcha legal therms
     *
     * @param {HTMLElement} options.legalTargetEl The div where the legal terms are added.
     */
    addLegalTerms: function (legalTargetEl) {
        if (!this._publicKey) {
            return false;
        }
        const template = document.createElement('template');
        template.innerHTML = qweb.render(`website.recaptcha_legal_terms`);
        this._legalTermsEl = template.content.firstElementChild;
        legalTargetEl.appendChild(this._legalTermsEl);
    },
    /**
     * @param {string} action
     * @returns {Promise}
     */
    getToken: async function (action) {
        if (!this._publicKey) {
            return false;
        }
        await this._recaptchaReady;
        return window.grecaptcha.execute(this._publicKey, {action: action});
    },
    /**
     * Remove the legal terms previously added to the legalTargetEl
     */
    removeLegalTerms: function () {
        if (this._legalTermsEl) {
            this._legalTermsEl.remove();
        }
    },
});

return {
    ReCaptcha: ReCaptcha,
};
});
