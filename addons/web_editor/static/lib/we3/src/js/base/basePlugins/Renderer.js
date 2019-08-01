(function () {
'use strict';

var Renderer = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['BaseRenderer'];
    }
    /**
     * Get a rendered node from its ID in the Arch.
     *
     * @param {int} id
     * @returns {Node}
     */
    getElement (id) {
        return this.dependencies.BaseRenderer.getElement(id);
    }
    /**
     * Get the ID in the Arch of a rendered Node.
     *
     * @param {Node} element
     */
    getID (element) {
        return this.dependencies.BaseRenderer.getID(element);
    }
    markAsDirty (id, options) {
        this.dependencies.BaseRenderer.markAsDirty(id, options);
    }
    /**
     * Render the changes.
     *
     * @param {Object} [options]
     * @param {Boolean} [options.showIDs]
     */
    redraw (options) {
        return this.dependencies.BaseRenderer.redraw(options);
    }
};

we3.pluginsRegistry.Renderer = Renderer;

})();
