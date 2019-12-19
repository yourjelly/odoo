odoo.define('web.Action', function (require) {
"use strict";

/**
 * This file defines the Action component which is instantiated by the
 * ActionManager.
 *
 * For the sake of backward compatibility, it uses an AdapterComponent.
 */

const AbstractView = require('web.AbstractView');
const AdapterComponent = require('web.AdapterComponent');

const { Component, tags } = owl;

// from https://medium.com/javascript-in-plain-english/how-to-deep-copy-objects-and-arrays-in-javascript-7c911359b089
const deepClone = inObject => {
  let outObject, value, key

  if(typeof inObject !== "object" || inObject === null) {
    return inObject; // Return the value if inObject is not an object
  }

  // Create an array or object to hold the values
  outObject = Array.isArray(inObject) ? [] : {};

  for (key in inObject) {
    value = inObject[key];

    // Recursively (deep) copy for nested objects, including arrays
    outObject[key] = (typeof value === "object" && value !== null) ? deepClone(value) : value;
  }

  return outObject;
};

class Action extends AdapterComponent {
    constructor(parent, props) {
        if (props.Component.prototype instanceof Component) {
            // FIXME: try to set it on Action again
            Action.components[props.Component] = props.Component;
            Action.template = tags.xml`<t t-component="Component" action="props.action" options="props.options"/>`;
            super(...arguments);
            this.components = Action.components;
            this.template = Action.template;
            Action.components = null;
            Action.template = null;
        } else {
            super(...arguments);
        }
    }

    async willStart() {
        if (this.props.Component.prototype instanceof AbstractView) {
            const action = this.props.action;
            const viewDescr = action.views.find(view => view.type === action.controller.viewType);
            const view = new viewDescr.View(viewDescr.fieldsView, action.controller.viewOptions);
            this.widget = await view.getController(this);
            return this.widget._widgetRenderAndInsert(() => {});
        }
        return super.willStart();
    }

    get widgetArgs() {
        // return [deepClone(this.props.action), deepClone(this.props.options)];
        return [this.props.action, this.props.options];
    }

    shouldUpdate() {
        return false;
    }

    // TODO: override destroy to keep actions in action stack alive?
}

return Action;

});
