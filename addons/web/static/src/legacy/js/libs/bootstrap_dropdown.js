/** @odoo-module **/

/**
 * The bootstrap library extensions and fixes should be done here to avoid
 * patching in place.
 */

/**
 * Bootstrap disables dynamic dropdown positioning when it is in a navbar. Here
 * we make this patch to activate this dynamic navbar's dropdown positioning
 * which is useful to avoid that the elements of the website sub-menus overflow
 * the page.
 */
Dropdown.prototype._detectNavbar = function () {
    return false;
};
