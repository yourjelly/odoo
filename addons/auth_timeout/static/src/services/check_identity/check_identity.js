import { Component, EventBus, onWillDestroy, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
import { rpc } from "@web/core/network/rpc";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { redirect } from "@web/core/utils/urls";
import { user } from "@web/core/user";
import { session } from "@web/session";

import { startAuthentication } from "../../../../../auth_passkey/static/lib/simplewebauthn.js";

export class CheckIdentityForm extends Component {
    static template = "auth_timeout.CheckIdentityForm";
    static props = {
        authMethods: { type: Array, element: String },
        redirect: { type: String, optional: true },
        close: { type: Function, optional: true },
    };

    setup() {
        super.setup();
        this.checkIdentity = useService("check_identity");
        this.checkIdentity.bus.trigger("start");
        onWillDestroy(async () => {
            this.checkIdentity.bus.trigger("close");
        });
        this.user = {
            userId: user.userId,
            login: user.login,
            authMethods: this.props.authMethods,
        };
        this.state = useState({
            error: false,
            authMethod: this.user.authMethods[0],
        });
        this.checkIdentity.channel.addEventListener("message", (event) => {
            if (event.data === "identityChecked") {
                this.close();
            }
        });
    }

    async onSubmit(ev) {
        const form = ev.target;
        if (form.querySelector('input[name="type"]').value === "webauthn") {
            const serverOptions = await rpc("/auth/passkey/start-auth");
            const auth = await startAuthentication(serverOptions).catch((e) => console.log(e));
            if (!auth) {
                return false;
            }
            form.querySelector('input[name="webauthn_response"]').value = JSON.stringify(auth);
        }
        const formData = new FormData(form);
        const formValues = Object.fromEntries(formData.entries());
        try {
            await rpc("/auth-timeout/session/check-identity", formValues);
            this.checkIdentity.channel.postMessage("identityChecked");
            this.close();
        } catch (error) {
            if (error.data) {
                this.state.error = error.data.message;
            } else {
                this.state.error = "Your identity could not be confirmed";
            }
        }
    }

    close() {
        if (this.props.close) {
            this.props.close();
        }
        if (this.props.redirect) {
            redirect(this.props.redirect);
        }
    }

    async onChangeAuthMethod(ev) {
        this.state.authMethod = ev.target.dataset.authMethod;
        this.state.error = false;
        if (this.state.authMethod == "totp_mail") {
            try {
                await rpc("/auth-timeout/send-totp-mail-code");
            } catch (error) {
                if (error.data) {
                    this.state.error = error.data.message;
                } else {
                    this.state.error = "The code could not be sent by email";
                }
            }
        }
    }
}

export class CheckIdentityDialog extends Component {
    static template = "auth_timeout.CheckIdentityDialog";
    static components = { Dialog, CheckIdentityForm };
    static props = {
        authMethods: { type: Array, element: String },
        close: Function, // prop added by the Dialog service
    };

    setup() {
        this.formProps = {
            authMethods: this.props.authMethods,
            close: this.props.close,
        };
    }
}

export const checkIdentityService = {
    dependencies: ["presence"],
    start(env, { presence }) {
        const channel = new BroadcastChannel("check_identity");
        const bus = new EventBus();
        let started = false;
        let inactivityTimer;

        bus.addEventListener("start", () => {
            started = true;
        });
        bus.addEventListener("close", () => {
            started = false;
        });

        const run = (authMethods) => {
            if (!started) {
                env.services.dialog.add(CheckIdentityDialog, { authMethods });
            }
            return new Promise((resolve) => {
                bus.addEventListener("close", resolve, { once: true });
            });
        };

        // Inactivity: Set a timer after which the check identity automatically appear.
        if (session.lock_timeout_inactivity) {
            const startInactivityTimer = () => {
                inactivityTimer = setTimeout(
                    async () => {
                        // Empty the current view, to not let any confidential data displayed
                        // not even inspecting the dom or through the console using Javascript.
                        env.services.action && env.bus.trigger("ACTION_MANAGER:UPDATE", {});
                        // Send the fact the user is away to the server.
                        const authMethods = await rpc("/auth-timeout/away");
                        // Display the check identity dialog
                        await run(authMethods);
                        // Reload the view to display back the data that was displayed before.
                        env.services.action && env.services.action.doAction("soft_reload");
                    },
                    session.lock_timeout_inactivity * 60 * 1000 - presence.getInactivityPeriod(),
                );
            };
            const clearInactivityTimer = () => {
                clearTimeout(inactivityTimer);
            };

            bus.addEventListener("start", clearInactivityTimer);
            bus.addEventListener("close", startInactivityTimer);
            presence.bus.addEventListener("presence", () => {
                if (!started) {
                    clearInactivityTimer();
                    startInactivityTimer();
                }
            });
            startInactivityTimer();
        }

        // Patch `rpc` to catch the `CheckIdentityException` exception and display the check identity dialog
        patch(rpc, {
            _rpc(url, params, settings) {
                // `rpc._rpc` returns a promise with an additional attribute `.abort`
                // It needs to be forwarded to the new promise as some feature requires it.
                // e.g.
                // `record_autocomplete.js`
                // ```js
                // if (this.lastProm) {
                //     this.lastProm.abort(false);
                // }
                // this.lastProm = this.search(name, SEARCH_LIMIT + 1);
                // ```
                // --test-tags /account_reports.test_tour_account_report_analytic_filters
                // --test-tags /web_studio.test_rename
                const originPromise = super._rpc(url, params, settings);
                const promise = originPromise.catch(async (error) => {
                    if (
                        error.data &&
                        error.data.name ===
                            "odoo.addons.auth_timeout.models.ir_http.CheckIdentityException"
                    ) {
                        await run(error.data.arguments[1]);
                        const newPromise = rpc._rpc(url, params, settings);
                        promise.abort = newPromise.abort;
                        return newPromise;
                    }
                    throw error;
                });
                promise.abort = originPromise.abort;
                return promise;
            },
        });

        return {
            channel,
            bus,
            run,
        };
    },
};

registry.category("public_components").add("auth_timeout.check_identity_form", CheckIdentityForm);
registry.category("services").add("check_identity", checkIdentityService);
