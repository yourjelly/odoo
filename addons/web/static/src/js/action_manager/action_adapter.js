odoo.define('web.ActionAdapter', function (require) {
    "use strict";

    /**
     * This file defines the Action component which is instantiated by the
     * ActionManager.
     *
     * For the sake of backward compatibility, it uses an ComponentAdapter.
     */

    const AbstractView = require('web.AbstractView');
    const { ComponentAdapter } = require('web.OwlCompatibility');

    class ActionAdapter extends ComponentAdapter {
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
            if (!this.inDialog) {
                const { onMounted , onWillUnmount } = owl.hooks;
                onMounted(() =>
                    this.actionManager.on('will-switch-action', this, this._onWillSwitchAction)
                );
                onWillUnmount(() =>
                    this.actionManager.off('will-switch-action', this)
                );
            }
        }
        get inDialog() {
            return this.props.inDialog;
        }
        get actionManager() {
            return this.env.actionManager;
        }

        //--------------------------------------------------------------------------
        // OWL Overrides
        //--------------------------------------------------------------------------

        patched() {
            if (this.legacy) {
                this.widgetReloadProm = null;
                if (this.widget && this.widget.on_attach_callback) {
                    this.widget.on_attach_callback();
                    console.log('attach', document.body.querySelector('.o_form_view'));
                }
                this.env.bus.trigger('DOM_updated');
            }
        }
        shouldUpdate(nextProps) {
            if (this.inDialog || (!this.inDialog && this.actionManager.actionKeys.dialog)) {
                return false;
            }
            return super.shouldUpdate(nextProps);
        }
        async willStart() {
            let prom;
            if (this.props.Component.prototype instanceof AbstractView) {
                // LPE: fixme (future self)
                // Those options being everywhere is hella annoying
                const {action , controller } = this.props;
                const viewDescr = action.views.find(view => view.type === controller.viewType);
                const breadcrumbs = this.actionManager.getBreadCrumbs();
                const viewParams = Object.assign(
                    {},
                    { action: action },
                    Object.assign(controller.viewOptions, { breadcrumbs }),
                );
                if (action.controllerState) {
                    Object.assign(
                        viewParams,
                        { controllerState: action.controllerState },
                    );
                }
                if (controller.ownedQueryParams) {
                    Object.assign(
                        viewParams,
                        { ownedQueryParams: controller.ownedQueryParams },
                    );
                }
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
        }


        //--------------------------------------------------------------------------
        // Getters
        //--------------------------------------------------------------------------
        get title() {
            if (this.legacy && this.widget) {
                return this.widget.getTitle();
            }
            return this.props.action.name;
        }
        get widgetArgs() {
            const breadcrumbs = this.actionManager.getBreadCrumbs();
            const options = Object.assign(this.props.controller.options, { breadcrumbs });
            return [this.props.action, options];
        }

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

        async canBeRemoved() {
            if (this.legacy && this.widget) {
                await this.widget.canBeRemoved();
            }
        }
        /**
         * @returns {Widget | Component | null} the legacy widget or owl Component
         *   instance, or null if this function is called too soon
         */
        getController() {
            if (this.legacy) {
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
            if (this.widget) {
                const state = {};
                if (this.widget.exportState) {
                    state.controllerState = this.widget.exportState();
                }
                if (this.widget.getOwnedQueryParams) {
                    state.ownedQueryParams = this.widget.getOwnedQueryParams();
                }
                return state;
            }
            return this.getState();
        }
        async updateWidget(nextProps) {
            const amState = this.actionManager.getRawState();
            if (this.widgetReloadProm || ('doOwlReload' in amState && !amState.doOwlReload)) {
                return this.widgetReloadProm;
            }
            if (this.legacy === 'view') {
                const { action , controller } = nextProps;
                const controllerState = action.controllerState || {};
                const breadcrumbs = this.actionManager.getBreadCrumbs();
                const reloadParam = Object.assign(
                    {offset: 0},
                    controller.viewOptions,
                    controller.options,
                    { controllerState , breadcrumbs },
                );
                return this.widget.reload(reloadParam);
            }
            return super.updateWidget(...arguments);
        }

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
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
        async _onWillSwitchAction({resolve, reject}) {
            const { controllerState , ownedQueryParams } = this.exportState();
            this.actionManager.updateAction(this.controller.jsID, {
                action: {
                    controllerState
                },
                controller: {
                    displayName: this.title,
                    ownedQueryParams
                }
            });
            return this.canBeRemoved().then(resolve).guardedCatch(reject);
        }
    }
    return  ActionAdapter;
});
