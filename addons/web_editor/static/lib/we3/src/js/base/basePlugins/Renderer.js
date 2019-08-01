(function () {
'use strict';

var Renderer = class extends we3.AbstractPlugin {
    constructor () {
        super(...arguments);
        this.dependencies = ['BaseRenderer'];
    }
    /**
     * Get a rendered node from its equivalent in the Arch (or its ID).
     *
     * @param {int|ArchNode} idOrArchNode
     * @param {boolean} [insertIfMissing]
     * @returns {Node}
     */
    getElement (idOrArchNode, insertIfMissing) {
        return this.dependencies.BaseRenderer.getElement(idOrArchNode, insertIfMissing);
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
