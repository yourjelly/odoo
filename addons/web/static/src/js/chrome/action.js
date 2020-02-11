odoo.define('web.Action', function (require) {
"use strict";

/**
 * This file defines the Action component which is instantiated by the
 * ActionManager.
 *
 * For the sake of backward compatibility, it uses an ComponentAdapter.
 */

const AbstractView = require('web.AbstractView');
const { ComponentAdapter } = require('web.OwlCompatibility');
const OwlDialog = require('web.OwlDialog');

var dom = require('web.dom');

class Action extends ComponentAdapter {
    constructor(parent, props) {
        super(...arguments);
        if (!(props.Component.prototype instanceof owl.Component)) {
            this.legacy = true;
        }
        this.boundController = this.props.action.controller;
        this.inDialog = 'inDialog' in this.props;
    }

    get title() {
        if (this.legacy && this.widget) {
            return this.widget.getTitle();
        }
        return this.props.action.name;
    }

    canBeRemoved() {
        if (this.legacy && this.widget) {
            return this.widget.canBeRemoved();
        }
    }

    async willStart() {
        if (this.props.Component.prototype instanceof AbstractView) {
            const action = this.props.action;
            const viewDescr = action.views.find(view => view.type === action.controller.viewType);
            const viewParams = Object.assign(
                {},
                { action: action, controllerState: action.controllerState },
                action.controller.viewOptions,
            );
            const view = new viewDescr.View(viewDescr.fieldsView, viewParams);
            this.widget = await view.getController(this);
            if (this.__owl__.isDestroyed) { // the action has been destroyed meanwhile
                this.widget.destroy();
                return;
            }
            if (this.inDialog) {
                this.env.bus.trigger('legacy-action', this.widget);
            }
            this.legacy = 'view';
            return this.widget._widgetRenderAndInsert(() => {});
        } else if (this.legacy) {
            this.legacy = 'action';
        }
        return super.willStart();
    }

    get widgetArgs() {
        return [this.props.action, this.props.options];
    }

    shouldUpdate(nextProps) {
        if (nextProps.shouldUpdate === false) {
            return false;
        }
        if (this.legacy) {
            const activatingViewType = nextProps.action.controller.viewType;
            let zombie = this.legacyZombie;
            if (activatingViewType === this.widget.viewType) {
                zombie = false;
            }
            return !zombie;
        }
        return super.shouldUpdate(nextProps);
    }
    _trigger_up(ev) {
        const evType = ev.name;
        if (!this.inDialog && this.legacy === 'view' && this.widget && (evType === "switch_view" || evType === "execute_action")) {
            const controllerState = this.widget.exportState();
            this.env.bus.trigger('legacy-reloaded', { controllerState });
        }
        return super._trigger_up(...arguments);
    }
    async updateWidget(nextProps) {
        if (this.legacy === 'view') {
            const action = nextProps.action;
            const controllerState = action.controllerState || {};
            const reloadParam = Object.assign(
                {offset: 0,},
                action.controller.viewOptions,
                nextProps.options,
                {
                     controllerState
                },
            );
            await this.widget.willRestore();
            return this.widget.reload(reloadParam);
        }
        return super.updateWidget(...arguments);
    }

/*    _reHookControllerMethods() {
        if (!('inDialog' in this.props)) {
            const self = this;
            const widget = this.widget;
            const controllerReload = widget.reload;
            this.widget.reload = async function(params) {
                await controllerReload.call(widget, ...arguments);
                const controllerState = widget.exportState();
                const commonState = {};
                if (params) {
                    if (params.context) {commonState.context = params.context;}
                }
                self.env.bus.trigger('legacy-reloaded', { commonState , controllerState });
            }
        }
    }*/

    getState() {
        if (this.widget) {
            return this.widget.getState();
        }
        return {}; // TODO
    }

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
    patched() {
        if (this.legacy && this.legacyZombie) {
            if (this.widget && this.widget.on_attach_callback) {
                this.widget.on_attach_callback();
            }
            this.legacyZombie = false;
        }
    }
}

class DialogAction extends owl.Component {
    constructor() {
        super(...arguments);
        this.dialog = owl.hooks.useRef('dialog');
        this.legacyActionWigdet = null;
        this.env.bus.on('legacy-action', this, (legacyWidget) => {
            this.legacyActionWigdet = legacyWidget;
        });
    }
    mounted() {
        if (this.legacyActionWigdet) {
            const footer = this.dialog.comp.footerRef.el;
            footer.innerHTML = "";
            this.legacyActionWigdet.renderButtons($(footer));
        }
        return super.mounted();
    }
}
DialogAction.template = owl.tags.xml`
    <OwlDialog t-props="props" t-ref="dialog">
        <t t-slot="default"/>
    </OwlDialog>`
DialogAction.components = { OwlDialog };

return { Action, DialogAction };

});
