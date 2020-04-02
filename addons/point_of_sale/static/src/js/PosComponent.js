odoo.define('point_of_sale.PosComponent', function(require) {
    'use strict';

    const { Component } = owl;
    const Registry = require('point_of_sale.ComponentsRegistry');

    class PosComponent extends Component {
        /**
         * This function is available to all Components that inherits this class.
         * The goal of this function is to show an awaitable dialog (popup) that
         * returns a response after user interaction. See the following for quick
         * demonstration:
         *
         * async getUserName() {
         *   const userResponse = await this.showPopup(
         *     'TextInputPopup',
         *     { title: 'What is your name?' }
         *   );
         *   // at this point, the TextInputPopup is displayed. Depending on how the popup is defined,
         *   // say the input contains the name, the result of the interaction with the user is
         *   // saved in `userResponse`.
         *   console.log(userResponse); // logs { confirmed: true, payload: <name> }
         * }
         *
         * @param {String} name Name of the popup component
         * @param {Object} props Object that will be used to render to popup
         */
        showPopup(name, props) {
            return new Promise(resolve => {
                this.trigger('show-popup', { name, props, resolve });
            });
        }
        showTempScreen(name, props) {
            return new Promise(resolve => {
                this.trigger('show-temp-screen', { name, props, resolve });
            });
        }
        showScreen(name, props) {
            this.trigger('show-main-screen', { name, props });
        }
        /**
         * TODO jcb: This is useless! It doesn't correctly return the target.
         *      The target is still Proxy.
         *
         * Returns the target object of the proxy instance created by the
         * useState hook. (This is kinda hack.)
         *
         * e.g.
         *
         * -- in the constructor --
         * this.state = useState({ val: 1 })
         * // this.state is a Proxy instance of the Observer
         *
         * -- in other methods --
         * const stateTarget = this.getStateTarget(this.state)
         * // stateTarget is now { val: <latestVal> } and is not Proxy.
         *
         * @param {Proxy} state state or Observer proxy object.
         */
        getStateTarget(state) {
            return this.__owl__.observer.weakMap.get(state).value;
        }
    }

    const repr = component => {
        if (typeof component === 'string') {
            return component;
        } else if (component instanceof Function) {
            return component.name;
        } else {
            throw new Error('Only owl.Component or string is allowed.');
        }
    };

    class ComponentsProxyHandler {
        constructor(parent, children) {
            this._parent = parent;
            this._childrenNames = new Set([...children.map(repr).filter(Boolean)]);
        }
        get(target, key) {
            return this._childrenNames.has(key) ? Registry.get(key) : null;
        }
        set(target, key, value) {
            if (this._childrenNames.has(key)) {
                console.warn(
                    `'${key}' is already declared as one of child components of '${this._parent}'`
                );
            } else {
                this._childrenNames.add(key);
            }
            return true;
        }
    }

    /**
     * Extends the static `components` of this Component with the given components array.
     *
     * @param {Array<Component|String>} components array of Components or Component names.
     */
    PosComponent.addComponents = function(components) {
        if (!this.hasOwnProperty('components')) {
            this.components = new Proxy({}, new ComponentsProxyHandler(this, components));
        } else {
            for (let component of components) {
                this.components[repr(component)] = component;
            }
        }
    };

    return PosComponent;
});
