odoo.define('web.ActionAdapter', function (require) {
    "use strict";

    /**
     * This file defines the Action component which is instantiated by the
     * ActionManager.
     *
     * For the sake of backward compatibility, it uses an ComponentAdapter.
     */

    const AbstractView = require('web.AbstractView');
    const ActionManager = require('web.ActionManager');
    const { ComponentAdapter } = require('web.OwlCompatibility');

    var dom = require('web.dom');

    class ActionAdapter extends ComponentAdapter {
        // TODO: those static stuff are annoying, but
        // somehow makes sense: the complexity of calling the
        // right Action object if concentrated here
        static registerInstance(instance) {
            if (!this.controllerMap) {
                this.controllerMap = new Map();
                const actionManager = instance.actionManager;
                actionManager.on('committed', this, payload => {
                    const { controllerCleaned } = payload || {};
                    if (controllerCleaned) {
                        this.cleanInstances(controllerCleaned);
                    }
                });
                actionManager.on('clear-uncommitted-changes', this, (resolve, reject) => {
                    const { controllerStack } = actionManager.state; 
                    const { controller } = controllerStack[controllerStack.length-1] || {};
                    const component = this.getInstance(controller && controller.jsID);
                    if (component) {
                        return component.canBeRemoved().then(resolve).guardedCatch(reject);
                    }
                    resolve();
                });
            }
            const jsID = instance.controller.jsID;
            const previous = this.controllerMap.get(jsID);
            this.controllerMap.set(jsID, instance);
            if (previous) {
                previous.destroy(true);
            }
        }
        static cleanInstances(jsIDList) {
            jsIDList.forEach(jsID => {
                const componentToDestroy = this.controllerMap.get(jsID);
                if (componentToDestroy) {
                    componentToDestroy.destroy(true);
                }
            });
        }
        static unRegisterInstance(instance) {
            const jsID = instance.controller.jsID;
            const _inst = this.controllerMap.get(jsID);
            if (_inst === instance) {
                this.controllerMap.delete(instance.controller.jsID);
            }
            if (!this.controllerMap.size) {
                instance.actionManager.off('committed', this);
                instance.actionManager.off('clear-uncommitted-changes', this);
                this.controllerMap = null;
            }
        }
        static getInstance(jsID, includeZombies) {
             const inst = this.controllerMap && this.controllerMap.get(jsID);
             if (includeZombies) {
                 return inst || null;
             }
             return inst && !inst.legacyZombie ? inst : null;
        }
        constructor(parent, props) {
            const { action, controller } = props;
            props.Component = controller.Component;
            super(...arguments);
            if (!(props.Component.prototype instanceof owl.Component)) {
                this.legacy = true;
                this.widgetReloadProm = null;
            }
            this.action = action;
            this.controller = controller;
            this.inDialog = 'inDialog' in this.props;
            this.actionManager = ActionManager.useActionManager();
        }

        //--------------------------------------------------------------------------
        // OWL Overrides
        //--------------------------------------------------------------------------

        destroy(force) {
            if (!this.inDialog && this.__owl__.isMounted && this.legacy && this.widget && !force) { // FIXME: do not detach twice?
                // keep legacy stuff alive because some stuff
                // are kept by AbstractModel (e.g.: orderedBy)
                dom.detach([{widget: this.widget}]);
                this.legacyZombie = true;
                return;
            }
            return super.destroy();
        }
        mounted() {
            this.constructor.registerInstance(this);
            super.mounted(...arguments);
        }
        patched() {
            if (this.legacy) {
                this.widgetReloadProm = null;
                if (this.legacyZombie) {
                    if (this.widget && this.widget.on_attach_callback) {
                        this.widget.on_attach_callback();
                        console.log('attach', document.body.querySelector('.o_form_view'));
                    }
                    this.env.bus.trigger('DOM_updated');
                    this.legacyZombie = false;
                }
            }
        }
        async render() {
            if (this.legacy && this.legacyZombie) {
                return;
            }
            return super.render(...arguments);
        }
        shouldUpdate(nextProps) {
            if (this.legacy) {
                if (!this.inDialog && this.actionManager.state.dialog) {
                    return false;
                }
                const activatingViewType = nextProps.controller.viewType;
                let zombie = this.legacyZombie;
                if (activatingViewType === this.widget.viewType) {
                    zombie = false;
                }
                return !zombie;
            }
            return super.shouldUpdate(nextProps);
        }
        async willStart() {
            let prom;
            if (this.props.Component.prototype instanceof AbstractView) {
                const {action , controller } = this.props;
                const viewDescr = action.views.find(view => view.type === controller.viewType);
                const breadcrumbs = this.breadCrumbs;
                const viewParams = Object.assign(
                    {},
                    { action: action, controllerState: action.controllerState },
                    Object.assign(controller.viewOptions, { breadcrumbs }),
                );
                const view = new viewDescr.View(viewDescr.fieldsView, viewParams);
                this.widget = await view.getController(this);
                if (this.__owl__.isDestroyed) { // the action has been destroyed meanwhile
                    this.widget.destroy();
                    return;
                }
                this.legacy = 'view';
                this._reHookControllerMethods();
                prom = this.widget._widgetRenderAndInsert(() => {});
            } else if (this.legacy) {
                this.legacy = 'action';
            }
            prom = prom || super.willStart();
            await prom;
            if (this.widget && this.inDialog) {
                this.env.bus.trigger('legacy-action', this.widget);
            }
        }


        //--------------------------------------------------------------------------
        // Getters
        //--------------------------------------------------------------------------
        get breadCrumbs() {
            const breadCrumbs = [];
            if (!this.inDialog) {
                const { controllerStack } = this.actionManager.state;
                for (let i=0; i<controllerStack.length; i++) {
                    const elm = controllerStack[i];
                    if (elm.controller.jsID === this.props.controller.jsID) {
                        break;
                    }
                    const bc = this._getBreadCrumb(elm);
                    if (bc === null) {
                        break;
                    }
                    breadCrumbs.push(bc);
                }
            }
            return breadCrumbs;
        }

        get title() {
            if (this.legacy && this.widget) {
                return this.widget.getTitle();
            }
            return this.props.action.name;
        }
        get widgetArgs() {
            const breadcrumbs = this.breadCrumbs;
            const options = Object.assign(this.props.controller.options, { breadcrumbs });
            return [this.props.action, options];
        }

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        async canBeRemoved() {
            if (this.legacy && this.widget && !this.legacyZombie) {
                await this.widget.canBeRemoved();
                if (this.widget.exportState) {
                    const controllerState = this.widget.exportState();
                    this.env.bus.trigger('legacy-export-state', { controllerState });
                }
            }
        }
        /**
         * @returns {Widget | Component | null} the legacy widget or owl Component
         *   instance, or null if this function is called too soon
         */
        getController() {
            if (this.legacy && !this.legacyZombie) {
                return this.widget;
            }
            return this.componentRef && this.componentRef.comp || null;
        }
        getState() {
            if (this.widget) {
                return this.widget.getState();
            }
            return {}; // TODO
        }
        exportState() {
            if (this.widget && this.widget.exportState) {
                return this.widget.exportState();
            }
            return this.getState();
        }
        async updateWidget(nextProps) {
            const amState = this.actionManager.state;
            if (this.widgetReloadProm || ('doOwlReload' in amState && !amState.doOwlReload)) {
                return this.widgetReloadProm;
            }
            if (this.legacy === 'view') {
                const { action , controller } = nextProps;
                const controllerState = action.controllerState || {};
                const breadcrumbs = this.breadCrumbs;
                const reloadParam = Object.assign(
                    {offset: 0},
                    controller.viewOptions,
                    controller.options,
                    { controllerState , breadcrumbs },
                );
                if (this.legacyZombie) {
                    await this.widget.willRestore();
                }
                return this.widget.reload(reloadParam);
            }
            return super.updateWidget(...arguments);
        }

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
        _getBreadCrumb({action, controller}) {
            const component = this.constructor.getInstance(controller.jsID, true);
            return {
                controllerID: controller.jsID,
                title: component && component.title || action.name,
            };
        }
        _reHookControllerMethods() {
            const self = this;
            const widget = this.widget;
            const controllerReload = widget.reload;
            this.widget.reload = function() {
                self.manualReload = true;
                self.widgetReloadProm = controllerReload.call(widget, ...arguments);
                return self.widgetReloadProm.then(() => {
                    if (self.manualReload) {
                        self.widgetReloadProm = null;
                        self.manualReload = false;
                    }
                });
            };
            const controllerUpdate = widget.update;
            this.widget.update = function() {
                const updateProm = controllerUpdate.call(widget, ...arguments);
                const manualUpdate = !self.manualReload;
                if (manualUpdate) {
                    self.widgetReloadProm = updateProm;
                }
                return updateProm.then(() => {
                    if (manualUpdate) {
                        self.widgetReloadProm = null;
                    }
                });
            };
        }
        _trigger_up(ev) {
            const evType = ev.name;
            // The legacy implementation forces us to export the current controller's state
            // any time we are to leave it temporarily, that is, the current controller
            // will stay in the breadcrumbs
/*            if (!this.inDialog && this.legacy === 'view' && this.widget && ['switch_view', 'execute_action', 'do_action'].includes(evType)) {
                const controllerState = this.widget.exportState();
                this.env.bus.trigger('legacy-export-state', { controllerState });
            }*/
            return super._trigger_up(...arguments);
        }
        __destroy() {
            this.constructor.unRegisterInstance(this);
            return super.__destroy(...arguments);
        }
    }
    return  ActionAdapter;
});
