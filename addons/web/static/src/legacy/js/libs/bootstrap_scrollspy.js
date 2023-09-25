/** @odoo-module **/

/**
 * The bootstrap library extensions and fixes should be done here to avoid
 * patching in place.
 */

/* Bootstrap scrollspy fix for non-body to spy */

const bootstrapSpyRefreshFunction = ScrollSpy.prototype.refresh;
ScrollSpy.prototype.refresh = function () {
    bootstrapSpyRefreshFunction.apply(this, arguments);
    if (this._scrollElement === window || this._config.method !== 'offset') {
        return;
    }
    const baseScrollTop = this._getScrollTop();
    for (let i = 0; i < this._offsets.length; i++) {
        this._offsets[i] += baseScrollTop;
    }
};

/**
 * In some cases, we need to keep the first element of navbars selected.
 */
const bootstrapSpyProcessFunction = ScrollSpy.prototype._process;
ScrollSpy.prototype._process = function () {
    bootstrapSpyProcessFunction.apply(this, arguments);
    if (this._activeTarget === null && this._config.alwaysKeepFirstActive) {
        this._activate(this._targets[0]);
    }
};

/**
 * With bootstrap 5, navigation elements must be in the DOM and be visible.
 * Since in the website editor, the user can hide the table of content block in
 * many different ways, it happens that the navigation element is no longer
 * found by bootstrap. We don't want to dispose scrollspy everywhere the block
 * could be hidden. So this patch imitates the behavior of bootstrap 4.X by not
 * causing an error if the navigation element is not found.
 */
const bootstrapSpyActivateFunction = ScrollSpy.prototype._activate;
ScrollSpy.prototype._activate = function (target) {
    const element = document.querySelector(`[href="${target}"]`);
    if (!element || $(element).is(':hidden')) {
        return;
    }
    bootstrapSpyActivateFunction.apply(this, arguments);
};
