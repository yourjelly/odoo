import { removeClass } from "./utils/dom";
import { initElementForEdition } from "./utils/sanitize";
import { MAIN_PLUGINS } from "./plugin_sets";

/**
 * @typedef { import("./plugin").SharedMethods } SharedMethods
 * @typedef {typeof import("./plugin").Plugin} PluginConstructor
 **/

/**
 * @typedef { Object } EditorConfig
 * @property { string } [content]
 * @property { boolean } [allowInlineAtRoot]
 * @property { PluginConstructor[] } [Plugins]
 * @property { boolean } [disableFloatingToolbar]
 * @property { string[] } [classList]
 * @property { Function } [getLocalOverlayContainer]
 * @property { Object } [inlineComponentInfo]
 * @property { Object } [resources]
 * @property { string } [direction="ltr"]
 */

function sortPlugins(plugins) {
    const initialPlugins = new Set(plugins);
    const inResult = new Set();
    // need to sort them
    const result = [];
    let P;

    function findPlugin() {
        for (const P of initialPlugins) {
            if (P.dependencies.every((dep) => inResult.has(dep))) {
                initialPlugins.delete(P);
                return P;
            }
        }
    }
    while ((P = findPlugin())) {
        inResult.add(P.name);
        result.push(P);
    }
    if (initialPlugins.size) {
        const messages = [];
        for (const P of initialPlugins) {
            messages.push(
                `"${P.name}" is missing (${P.dependencies
                    .filter((d) => !inResult.has(d))
                    .join(", ")})`
            );
        }
        throw new Error(`Missing dependencies:  ${messages.join(", ")}`);
    }
    return result;
}

export class Editor {
    /**
     * @param { EditorConfig } config
     * @param {*} services
     */
    constructor(config, services) {
        this.isDestroyed = false;
        this.config = config;
        this.services = services;
        this.plugins = [];
        /** @type { HTMLElement } **/
        this.editable = null;
        /** @type { Document } **/
        this.document = null;
        /** @ts-ignore  @type { SharedMethods } **/
        this.shared = {};
    }

    attachTo(editable) {
        if (this.isDestroyed || this.editable) {
            throw new Error("Cannot re-attach an editor");
        }
        this.editable = editable;
        this.document = editable.ownerDocument;
        if (this.config.content) {
            editable.innerHTML = this.config.content;
        }
        editable.setAttribute("contenteditable", true);
        initElementForEdition(editable, { allowInlineAtRoot: !!this.config.allowInlineAtRoot });
        editable.classList.add("odoo-editor-editable");
        if (this.config.classList) {
            editable.classList.add(...this.config.classList);
        }
        this.startPlugins();
    }

    startPlugins() {
        const Plugins = sortPlugins(this.config.Plugins || MAIN_PLUGINS);
        const plugins = new Map();
        const dispatch = this.dispatch.bind(this);
        for (const P of Plugins) {
            if (P.name === "") {
                throw new Error(`Missing plugin name (class ${P.constructor.name})`);
            }
            if (plugins.has(P.name)) {
                throw new Error(`Duplicate plugin name: ${P.name}`);
            }
            const _shared = {};
            for (const dep of P.dependencies) {
                if (plugins.has(dep)) {
                    for (const h of plugins.get(dep).shared) {
                        _shared[h] = this.shared[h];
                    }
                } else {
                    throw new Error(`Missing dependency for plugin ${P.name}: ${dep}`);
                }
            }
            plugins.set(P.name, P);
            const plugin = new P(
                this.document,
                this.editable,
                _shared,
                dispatch,
                this.config,
                this.services
            );
            this.plugins.push(plugin);
            for (const h of P.shared) {
                if (h in this.shared) {
                    throw new Error(`Duplicate shared name: ${h}`);
                }
                if (!(h in plugin)) {
                    throw new Error(`Missing helper implementation: ${h} in plugin ${P.name}`);
                }
                this.shared[h] = plugin[h].bind(plugin);
            }
        }
        const resources = this.createResources();
        for (const plugin of this.plugins) {
            plugin.resources = resources;
            plugin.setup();
        }
        this.dispatch("NORMALIZE", { node: this.editable });
    }

    createResources() {
        const resources = {};

        function registerResources(obj) {
            for (const key in obj) {
                if (!(key in resources)) {
                    resources[key] = [];
                }
                resources[key].push(obj[key]);
            }
        }
        if (this.config.resources) {
            registerResources(this.config.resources);
        }
        for (const plugin of this.plugins) {
            if (plugin.constructor.resources) {
                registerResources(plugin.constructor.resources(plugin));
            }
        }

        for (const key in resources) {
            resources[key] = resources[key].flat();
        }

        return resources;
    }

    dispatch(command, payload = {}) {
        if (!this.editable) {
            throw new Error("Cannot dispatch command while not attached to an element");
        }
        for (const p of this.plugins) {
            p.handleCommand(command, payload);
        }
    }

    destroy(willBeRemoved) {
        if (this.editable) {
            if (!willBeRemoved) {
                // we only remove class/attributes when necessary. If we know that the editable
                // element will be removed, no need to make changes that may require the browser
                // to recompute the layout
                this.editable.removeAttribute("contenteditable");
                removeClass(this.editable, "odoo-editor-editable");
            }
            for (const p of this.plugins) {
                p.destroy();
            }
            this.editable = null;
        }
        this.isDestroyed = true;
    }
}
