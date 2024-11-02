import { registry } from "@web/core/registry";
import { _t, translationIsReady } from "@web/core/l10n/translation";
import { Interaction } from "./interaction";
import { Colibri } from "./colibri";
import { getTemplate } from "@web/core/templates";

/**
 * Website Core
 *
 * This service handles the core interactions for the website codebase.
 * It will replace public root, publicroot instance, and all that stuff
 *
 * We have 2 kinds of interactions:
 * - simple interactions (subclasses of Interaction)
 * - components
 *
 * The Interaction class is designed to be a simple class that provides access
 * to the framework (env and services), and a minimalist declarative framework
 * that allows manipulating dom, attaching event handlers and updating it
 * properly. It does not depend on owl.
 *
 * The Component kind of interaction is used for more complicated interface needs.
 * It provides full access to Owl features, but is rendered browser side.
 *
 */

const activeElementRegistry = registry.category("website.active_elements");

class WebsiteCore {
    constructor(env) {
        this.el = document.querySelector("#wrapwrap");
        this.isActive = false;
        this.env = env;
        this.interactions = [];
        this.roots = [];
        this.colibri = new Colibri(this.env);
        this.app = null;
        this.startInteractions();
        activeElementRegistry.addEventListener("UPDATE", async (ev) => {
            if (this.isActive) {
                const { operation, key: name, value: I } = ev.detail;
                if (operation !== "delete") {
                    this._startInteraction(name, I);
                }
            }
        });
    }

    async _mountComponent(el, C) {
        if (!this.app) {
            await translationIsReady;
            const { App } = odoo.loader.modules.get("@odoo/owl");
            const appConfig = {
                name: "Odoo Website",
                getTemplate,
                env: this.env,
                dev: this.env.debug,
                translateFn: _t,
                warnIfNoStaticProps: this.env.debug,
                translatableAttributes: ["data-tooltip"],
            };
            this.app = new App(null, appConfig);
        }
        if (!this.active) {
            return;
        }
        const root = this.app.createRoot(C, { props: null, env: this.env });
        this.roots.push(root);
        const compElem = document.createElement("owl-component");
        compElem.setAttribute("contenteditable", "false");
        compElem.dataset.oeProtected = "true";
        el.appendChild(compElem);
        root.mount(compElem);
    }

    startInteractions() {
        if (!this.active) {
            for (const [name, I] of activeElementRegistry.getEntries()) {
                if (this.el.matches(I.selector)) {
                    console.log("starting", name);
                    this._startInteraction(this.el, I);
                } else {
                    for (let el of this.el.querySelectorAll(I.selector)) {
                        console.log("starting", name);
                        this._startInteraction(el, I);
                    }
                }
            }
            this.active = true;
        }
    }

    _startInteraction(el, I) {
        if (I.prototype instanceof Interaction) {
            const interaction = this.colibri.attach(el, I);
            this.interactions.push(interaction);
        } else {
            this._mountComponent(el, I);
        }
    }

    stopInteractions() {
        for (let interaction of this.interactions) {
            interaction.destroy();
        }
        this.interactions = [];
        for (let root of this.roots) {
            root.destroy();
        }
        this.roots = [];
        this.isActive = false;
    }
}

registry.category("services").add("website_core", {
    async start(env) {
        return new WebsiteCore(env);
    },
});
