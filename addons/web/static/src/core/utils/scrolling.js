/**
 * Get the closest horizontally scrollable for a given element.
 *
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
export function closestScrollableX(el) {
    if (!el) {
        return null;
    }
    if (el.scrollWidth > el.clientWidth && el.clientWidth > 0) {
        const overflow = getComputedStyle(el).getPropertyValue("overflow-x");
        if (/\bauto\b|\bscroll\b/.test(overflow)) {
            return el;
        }
    }
    return closestScrollableX(el.parentElement);
}

/**
 * Get the closest vertically scrollable for a given element.
 *
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
export function closestScrollableY(el) {
    if (!el) {
        return null;
    }
    if (el.scrollHeight > el.clientHeight && el.clientHeight > 0) {
        const overflow = getComputedStyle(el).getPropertyValue("overflow-y");
        if (/\bauto\b|\bscroll\b/.test(overflow)) {
            return el;
        }
    }
    return closestScrollableY(el.parentElement);
}

/**
 * Ensures that `element` will be visible in its `scrollable`.
 *
 * @param {HTMLElement} element
 * @param {Object} options
 * @param {HTMLElement} [options.scrollable] a scrollable area
 * @param {Boolean} [options.isAnchor] states if the scroll is to an anchor
 * @param {String} [options.behavior] "smooth", "instant", "auto" <=> undefined
 *        @url https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollTo#behavior
 */
export function scrollTo(
    element,
    options = { behavior: "auto", scrollable: null, isAnchor: false }
) {
    if (!element) {
        return Promise.reject(new Error("No element found"));
    }
    const scrollable =
        closestScrollableY(options.scrollable || element.parentElement) ||
        document.scrollingElement;

    const scrollBottom = scrollable.getBoundingClientRect().bottom;
    const scrollTop = scrollable.getBoundingClientRect().top;
    const elementBottom = element.getBoundingClientRect().bottom;
    const elementTop = element.getBoundingClientRect().top;

    let targetScrollTop;

    if (elementBottom > scrollBottom && !options.isAnchor) {
        // The scroll place the element at the bottom border of the scrollable
        targetScrollTop = scrollable.scrollTop +
            elementTop -
            scrollBottom +
            Math.ceil(element.getBoundingClientRect().height);
    } else if (elementTop < scrollTop || options.isAnchor) {
        // The scroll place the element at the top of the scrollable
        targetScrollTop = scrollable.scrollTop - scrollTop + elementTop;

        if (options.isAnchor) {
            // If the scrollable is within a scrollable, another scroll should be done
            const parentScrollable = closestScrollableY(scrollable.parentElement);
            if (parentScrollable) {
                return scrollTo(scrollable, {
                    behavior: options.behavior,
                    isAnchor: true,
                    scrollable: parentScrollable,
                });
            }
        }
    } else {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const onScrollEnd = () => {
            scrollable.removeEventListener('scrollend', onScrollEnd);
            resolve();
        };

        scrollable.addEventListener('scrollend', onScrollEnd, { once: true });

        scrollable.scrollTo({
            top: targetScrollTop,
            behavior: options.behavior,
        });
    });
}
