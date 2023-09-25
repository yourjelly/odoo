/** @odoo-module **/

/**
 * The bootstrap library extensions and fixes should be done here to avoid
 * patching in place.
 */

/* Bootstrap modal scrollbar compensation on non-body */
const bsAdjustDialogFunction = Modal.prototype._adjustDialog;
Modal.prototype._adjustDialog = function () {
    const document = this._element.ownerDocument;
    document.body.classList.remove('modal-open');
    const $scrollable = $().getScrollingElement(document);
    if (document.body.contains($scrollable[0])) {
        $scrollable.compensateScrollbar(true);
    }
    document.body.classList.add('modal-open');
    return bsAdjustDialogFunction.apply(this, arguments);
};

const bsResetAdjustmentsFunction = Modal.prototype._resetAdjustments;
Modal.prototype._resetAdjustments = function () {
    const document = this._element.ownerDocument;
    document.body.classList.remove('modal-open');
    const $scrollable = $().getScrollingElement(document);
    if (document.body.contains($scrollable[0])) {
        $scrollable.compensateScrollbar(false);
    }
    return bsResetAdjustmentsFunction.apply(this, arguments);
};
