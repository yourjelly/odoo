/**
 * @return {Node}
 */
function closestScrollable(element) {
    const document = element ? element.ownerDocument : window.document;
    let el = element;
    while (el !== document.scrollingElement) {
        if (!el || el instanceof Document) {
            return null;
        }
        if (isScrollable(el)) {
            return el;
        }
        el = el.parentNode;
    }
    return el;
}
/**
 * Adapt the given css property by adding the size of a scrollbar if any.
 * Limitation: only works if the given css property is not already used as
 * inline style for another reason.
 *
 * @param {boolean} [add=true]
 * @param {boolean} [isScrollElement=true]
 * @param {string} [cssProperty='padding-right']
 */
function compensateScrollbar(add = true, isScrollElement = true, cssProperty = "padding-right") {
    for (const el of this) {
        // Compensate scrollbar
        const scrollableEl = isScrollElement ? el : closestScrollable(el.parentNode);
        const isRTL = scrollableEl.matches(".o_rtl");
        if (isRTL) {
            cssProperty = cssProperty.replace("right", "left");
        }
        el.style.removeProperty(cssProperty);
        if (!add) {
            return;
        }
        const style = getComputedStyle(el);
        // Round up to the nearest integer to be as close as possible to
        // the correct value in case of browser zoom.
        const borderLeftWidth = Math.ceil(parseFloat(style.borderLeftWidth.replace("px", "")));
        const borderRightWidth = Math.ceil(parseFloat(style.borderRightWidth.replace("px", "")));
        const bordersWidth = borderLeftWidth + borderRightWidth;
        const newValue =
            parseInt(style[cssProperty]) +
            scrollableEl.offsetWidth -
            scrollableEl.clientWidth -
            bordersWidth;
        el.style.setProperty(cssProperty, `${newValue}px`, "important");
    }
}
/**
 * @returns {Node}
 */
function getScrollingElement(document = window.document) {
    const baseScrollingElement = document.scrollingElement;
    if (isScrollable(baseScrollingElement) && hasScrollableContent(baseScrollingElement)) {
        return baseScrollingElement;
    }
    const bodyHeight = document.body.offsetHeight;
    for (const el of document.body.children) {
        // Search for a body child which is at least as tall as the body
        // and which has the ability to scroll if enough content in it. If
        // found, suppose this is the top scrolling element.
        if (bodyHeight - el.scrollHeight > 1.5) {
            continue;
        }
        if (isScrollable(el)) {
            return el;
        }
    }
    return baseScrollingElement;
}
/**
 * @returns {Node}
 */
function getScrollingTarget(contextItem = window.document) {
    const scrollingElement =
        contextItem instanceof Element ? contextItem : getScrollingElement(contextItem);
    const document = scrollingElement.ownerDocument;
    return scrollingElement.matches(document.scrollingElement)
        ? document.defaultView
        : scrollingElement;
}

/**
 * @return {boolean}
 */
function hasScrollableContent(element) {
    return element.scrollHeight > element.clientHeight;
}

/**
 * @returns {boolean}
 */
function isScrollable(element) {
    if (!element) {
        return false;
    }
    const overflowY = getComputedStyle(element).overflowY;
    return (
        overflowY === "auto" ||
        overflowY === "scroll" ||
        (overflowY === "visible" && element === element.ownerDocument.scrollingElement)
    );
}

export {
    closestScrollable,
    compensateScrollbar,
    getScrollingElement,
    getScrollingTarget,
    hasScrollableContent,
    isScrollable,
};
