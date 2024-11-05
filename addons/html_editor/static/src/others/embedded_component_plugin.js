import { Plugin } from "@html_editor/plugin";
import { App } from "@odoo/owl";
import { memoize } from "@web/core/utils/functions";

/**
 * This plugin is responsible with providing the API to manipulate/insert
 * sub components in an editor.
 */
export class EmbeddedComponentPlugin extends Plugin {
    static id = "embeddedComponents";
    static dependencies = ["history", "protectedNode"];
    resources = {
        serializable_descendants_processors: this.processDescendantsToSerialize.bind(this),
        savable_mutation_record_predicates: this.isMutationRecordSavable.bind(this),
        attribute_change_handlers: this.onChangeAttribute.bind(this),
        attribute_change_processors: this.onChangeAttribute.bind(this),
        clean_for_save_handlers: ({ root }) => this.cleanForSave(root),
        normalize_handlers: this.normalize.bind(this),
        restore_savepoint_handlers: () => this.handleComponents(this.editable),
        history_reset_handlers: () => this.handleComponents(this.editable),
        history_reset_from_steps_handlers: () => this.handleComponents(this.editable),
        step_added_handlers: ({ stepCommonAncestor }) => this.handleComponents(stepCommonAncestor),
        external_step_added_handlers: () => this.handleComponents(this.editable),
    };

    setup() {
        this.components = new Set();
        // map from node to component info
        this.nodeMap = new WeakMap();
        this.app = this.config.embeddedComponentInfo.app;
        this.env = this.config.embeddedComponentInfo.env;
        this.hostToStateChangeManagerMap = new WeakMap();
        this.embeddedComponents = memoize((embeddedComponents = []) => {
            const result = {};
            for (const embedding of embeddedComponents) {
                // TODO ABD: Any embedding with the same name as another will overwrite it.
                // File currently relies on this system. Change it ?
                result[embedding.name] = embedding;
            }
            return result;
        });
        // First mount is done during history_reset_handlers which happens
        // when start_edition_handlers are called.
    }

    isMutationRecordSavable(record) {
        const info = this.nodeMap.get(record.target);
        if (
            info &&
            record.type === "attributes" &&
            record.attributeName === "data-embedded-props"
        ) {
            // This attribute is determined independently for each user
            // through `data-embedded-state` attribute mutations.
            return false;
        }
        return true;
    }

    processDescendantsToSerialize(elem, serializableDescendants) {
        const embedding = this.getEmbedding(elem);
        if (!embedding) {
            return serializableDescendants;
        }
        return Object.values(embedding.getEditableDescendants?.(elem) || {});
    }

    handleComponents(elem) {
        this.destroyRemovedComponents([...this.components]);
        this.forEachEmbeddedComponentHost(elem, (host, embedding) => {
            const info = this.nodeMap.get(host);
            if (!info) {
                this.mountComponent(host, embedding);
            }
        });
    }

    forEachEmbeddedComponentHost(elem, callback) {
        const selector = `[data-embedded]`;
        const targets = [...elem.querySelectorAll(selector)];
        if (elem.matches(selector)) {
            targets.unshift(elem);
        }
        for (const host of targets) {
            const embedding = this.getEmbedding(host);
            if (!embedding) {
                continue;
            }
            callback(host, embedding);
        }
    }

    getEmbedding(host) {
        return this.embeddedComponents(this.getResource("embedded_components"))[
            host.dataset.embedded
        ];
    }

    /**
     * Apply an embedded state change received from `data-embedded-state`
     * attribute. In some cases (undo/redo/revertStepsUntil history operations),
     * the attribute has to be set to a new value, computed by the
     * stateChangeManager.
     *
     * @param {Object} attributeChange @see HistoryPlugin
     * @param { Object } options
     * @param { boolean } options.forNewStep whether the mutation is being used
     *        to create a new step
     * @returns {string} new attribute value to set on the node, which might be
     *        unchanged
     */
    onChangeAttribute(attributeChange, { forNewStep = false } = {}) {
        const attributeValue = attributeChange.value;
        let newAttributeValue;
        if (attributeChange.attributeName === "data-embedded-state") {
            const attrState = attributeChange.reverse
                ? attributeChange.oldValue
                : attributeChange.value;
            const stateChangeManager = this.getStateChangeManager(attributeChange.target);
            if (stateChangeManager) {
                // onStateChanged returns undefined if no change is needed for
                // the attribute value
                newAttributeValue = stateChangeManager.onStateChanged(attrState, {
                    reverse: attributeChange.reverse,
                    forNewStep,
                });
            }
        }
        return newAttributeValue || attributeValue;
    }

    getStateChangeManager(host) {
        const embedding = this.getEmbedding(host);
        if (!("getStateChangeManager" in embedding)) {
            return null;
        }
        if (!this.hostToStateChangeManagerMap.has(host)) {
            const config = {
                host,
                commitStateChanges: () => this.dependencies.history.addStep(),
            };
            const stateChangeManager = embedding.getStateChangeManager(config);
            stateChangeManager.setup();
            this.hostToStateChangeManagerMap.set(host, stateChangeManager);
        }
        return this.hostToStateChangeManagerMap.get(host);
    }

    mountComponent(
        host,
        { Component, getEditableDescendants, getProps, name, getStateChangeManager }
    ) {
        const props = getProps?.(host) || {};
        const { dev, translateFn, getRawTemplate } = this.app;
        const env = Object.create(this.env);
        if (getStateChangeManager) {
            env.getStateChangeManager = this.getStateChangeManager.bind(this);
        }
        if (getEditableDescendants) {
            env.getEditableDescendants = getEditableDescendants;
        }
        this.dispatchTo("mount_component_handlers", { name, env, props });
        const app = new App(Component, {
            test: dev,
            env,
            translateFn,
            getTemplate: getRawTemplate,
            props,
        });
        app.rawTemplates = this.app.rawTemplates;
        // Can't copy compiled templates because they have a reference to the main app
        // app.templates = mainApp.templates;
        app.mount(host);
        // Patch mount fiber to hook into the exact call stack where app is
        // mounted (but before). This will remove host children synchronously
        // just before adding the app rendered html.
        const fiber = Array.from(app.scheduler.tasks)[0];
        const fiberComplete = fiber.complete;
        fiber.complete = function () {
            host.replaceChildren();
            fiberComplete.call(this);
        };
        const info = {
            app,
            host,
        };
        this.components.add(info);
        this.nodeMap.set(host, info);
    }

    destroyRemovedComponents(infos) {
        for (const info of infos) {
            if (!this.editable.contains(info.host)) {
                const host = info.host;
                const display = host.style.display;
                const parentNode = host.parentNode;
                const clone = host.cloneNode(false);
                if (parentNode) {
                    parentNode.replaceChild(clone, host);
                }
                host.style.display = "none";
                this.editable.after(host);
                this.destroyComponent(info);
                if (parentNode) {
                    parentNode.replaceChild(host, clone);
                } else {
                    host.remove();
                }
                host.style.display = display;
                if (!host.getAttribute("style")) {
                    host.removeAttribute("style");
                }
            }
        }
    }

    deepDestroyComponent({ host }) {
        const removed = [];
        this.forEachEmbeddedComponentHost(host, (containedHost) => {
            const info = this.nodeMap.get(containedHost);
            if (info) {
                if (this.editable.contains(containedHost)) {
                    this.destroyComponent(info);
                } else {
                    removed.push(info);
                }
            }
        });
        this.destroyRemovedComponents(removed);
    }

    /**
     * Should not be called directly as it will not handle recursivity and
     * removed components @see deepDestroyComponent
     */
    destroyComponent({ app, host }) {
        const { getEditableDescendants } = this.getEmbedding(host);
        const editableDescendants = getEditableDescendants?.(host) || {};
        app.destroy();
        this.components.delete(arguments[0]);
        this.nodeMap.delete(host);
        host.append(...Object.values(editableDescendants));
    }

    destroy() {
        super.destroy();
        for (const info of [...this.components]) {
            if (this.components.has(info)) {
                this.deepDestroyComponent(info);
            }
        }
    }

    normalize(elem) {
        this.forEachEmbeddedComponentHost(elem, (host, { getEditableDescendants }) => {
            this.dependencies.protectedNode.setProtectingNode(host, true);
            const editableDescendants = getEditableDescendants?.(host) || {};
            for (const editableDescendant of Object.values(editableDescendants)) {
                this.dependencies.protectedNode.setProtectingNode(editableDescendant, false);
            }
        });
    }

    cleanForSave(clone) {
        this.forEachEmbeddedComponentHost(clone, (host, { getEditableDescendants }) => {
            // In this case, host is a cloned element, there is no
            // live app attached to it.
            const editableDescendants = getEditableDescendants?.(host) || {};
            host.replaceChildren();
            for (const editableDescendant of Object.values(editableDescendants)) {
                delete editableDescendant.dataset.oeProtected;
                host.append(editableDescendant);
            }
            delete host.dataset.oeProtected;
            delete host.dataset.embeddedState;
        });
    }
}
