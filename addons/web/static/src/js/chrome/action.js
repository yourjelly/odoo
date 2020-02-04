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

var dom = require('web.dom');

class Action extends ComponentAdapter {
    constructor(parent, props) {
        super(...arguments);
        if (!(props.Component.prototype instanceof owl.Component)) {
            this.legacy = true;
        }
        this.boundController = this.props.action.controller;
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
            const initState = this.widget.exportState();
            const controllerState = {
                resIds: initState.resIds,
            }
            this.env.bus.trigger('legacy-loaded', { controllerState });
            this.legacy = 'view';
            this._reHookControllerMethods();
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
            if (activatingViewType === this.widget.viewType) {
                this.legacyZombie = false;
            }
            return !this.legacyZombie;
        }
        return super.shouldUpdate(nextProps);
    }
    async update(nextProps) {
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
        return super.update(...arguments);
    }

    _reHookControllerMethods() {
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

    getState() {
        if (this.widget) {
            return this.widget.getState();
        }
        return {}; // TODO
    }

    destroy(force) {
        if (this.legacy && this.widget && !force) {
            // keep legacy stuff alive because some stuff
            // are kept by AbstractModel (e.g.: orderedBy)
            dom.detach([{widget: this.widget}]);
            this.legacyZombie = true;
            return;
        }
        return super.destroy();
    }
}

return Action;

});
