odoo.define('point_of_sale.Gui', function (require) {
    'use strict';

    /**
     * This module bridges Chrome (owl.Component) to other data classes
     * (such as those defined in models.js) but not vice versa.
     *
     * The idea is to be able to perform side-effects to the user interface
     * during calculation. Think of console.log during times we want to see
     * the result of calculations. This is no different, except that instead
     * of printing something in the console, we access a method in the user
     * interface then the user interface reacts, e.g. calling `showPopup`.
     *
     * This however can be dangerous to the user interface as it can be possible
     * that a rendered component is destroyed during the calculation. Because of
     * this, we are going to limit external ui controls to those safe ones to use:
     *  - `showPopup`
     *  - `showTempScreen`
     */

    const config = {};

    /**
     * Call this when the user interface is ready. Provide the component
     * that will be used to control the ui.
     * @param {owl.component} component component having the ui methods.
     */
    const configureGui = ({ component }) => {
        config.component = component;
        config.availableMethods = new Set([
            'showPopup',
            'showTempScreen',
            'playSound',
            'setSyncStatus',
        ]);
    };

    /**
     * Import this and consume like so: `Gui.showPopup(<PopupName>, <props>)`.
     * Like you would call `showPopup` in a component.
     */
    const Gui = new Proxy(config, {
        get(target, key) {
            const { component, availableMethods } = target;
            if (!component) throw new Error(`Call 'configureGui' before using Gui.`);
            const isMounted = component.__owl__.isMounted;
            if (availableMethods.has(key) && isMounted) {
                return component[key].bind(component);
            }
        },
    });

    return { configureGui, Gui };
});
