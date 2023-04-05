/** @odoo-module **/
    
    import Registry from "web.Registry";

    const { Component } = owl;

    export const fieldRegistry = new Registry(
        null,
        (value) => !(value.prototype instanceof Component)
    );
