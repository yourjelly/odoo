/** @odoo-module **/

import { debounce } from "@web/core/utils/timing";

// Constants for class names and data attributes
export const MASONRY = {
    CLASSES: {
        MODE: "o_masonry_mode",
        FIXED_COLUMNS: "s_nb_column_fixed",
        COLUMN: "o_masonry_col",
        ITEM: "w-100",
        GRID: "o_grid_mode",
        NOT_SELECTABLE: "o_snippet_not_selectable",
    },
    DATA_ATTRS: {
        DESKTOP_COLUMNS: "data-columns",
        MOBILE_COLUMNS: "data-mobile-columns",
        ITEM_INDEX: "data-index",
    },
    DEFAULTS: {
        DESKTOP_COLUMNS: 3,
        MOBILE_COLUMNS: 1,
    },
};

/**
 * Gets the number of columns for desktop and mobile based on container's
 * column attribute (between 1 and 12).
 *
 * @private
 * @param {Element} containerEl - The container element
 * @returns {Object} Object containing desktop and mobile column counts
 */
function _getColumnConfiguration(containerEl) {
    const desktopColumns =
        parseInt(containerEl.parentElement.getAttribute(MASONRY.DATA_ATTRS.DESKTOP_COLUMNS)) ||
        MASONRY.DEFAULTS.DESKTOP_COLUMNS;
    const mobileColumns =
        parseInt(containerEl.parentElement.getAttribute(MASONRY.DATA_ATTRS.MOBILE_COLUMNS)) ||
        MASONRY.DEFAULTS.MOBILE_COLUMNS;

    return {
        desktop: Math.min(Math.max(desktopColumns, 1), 12),
        mobile: Math.min(Math.max(mobileColumns, 1), 12),
    };
}

/**
 * Creates masonry column elements based on the configuration.
 *
 * @private
 * @param {number} desktopColumns - Number of columns for desktop
 * @param {number} mobileColumns - Number of columns for mobile
 * @returns {Element[]} Array of column elements
 */
function _createColumnElements(desktopColumns, mobileColumns) {
    const columns = [];
    const desktopColSize = Math.floor(12 / desktopColumns);
    const mobileColSize = Math.floor(12 / mobileColumns);

    for (let i = 0; i < desktopColumns; i++) {
        const columnEl = document.createElement("div");
        columnEl.classList.add(
            MASONRY.CLASSES.COLUMN,
            MASONRY.CLASSES.NOT_SELECTABLE,
            `col-${mobileColSize}`,
            `col-lg-${desktopColSize}`
        );
        columns.push(columnEl);
    }

    return columns;
}

/**
 * Finds the shortest column in the masonry layout.
 *
 * @private
 * @param {Element[]} columns - Array of column elements
 * @returns {Element} The shortest column element
 */
function _getShortestColumn(columns) {
    return columns.reduce((shortest, current) => {
        const currentHeight = current.lastElementChild
            ? current.lastElementChild.getBoundingClientRect().bottom
            : current.getBoundingClientRect().top;
        const shortestHeight = shortest.lastElementChild
            ? shortest.lastElementChild.getBoundingClientRect().bottom
            : shortest.getBoundingClientRect().top;

        return currentHeight < shortestHeight ? current : shortest;
    }, columns[0]);
}

/**
 * Retrieves and sorts the original elements from the row based on the defined
 * data index attribute.
 * It also considers the possibility of elements being wrapped in a
 * link (anchor) tag.
 *
 * @param {Element} rowEl - The row element containing child elements with data
 *                          index attributes.
 * @returns {Element[]} An array of child elements or their wrappers sorted by
 *                      the specified data index attribute.
 */
export function _getOriginalElements(rowEl) {
    if (!rowEl || !rowEl.children) {
        return [];
    }

    const hasIndex = (element) => element?.hasAttribute(MASONRY.DATA_ATTRS.ITEM_INDEX);
    const getIndex = (element) => {
        if (element.hasAttribute(MASONRY.DATA_ATTRS.ITEM_INDEX)) {
            return Number(element.getAttribute(MASONRY.DATA_ATTRS.ITEM_INDEX));
        }
        const firstChildEl = element.firstChild;
        if (firstChildEl?.hasAttribute(MASONRY.DATA_ATTRS.ITEM_INDEX)) {
            return Number(firstChildEl.getAttribute(MASONRY.DATA_ATTRS.ITEM_INDEX));
        }
        return 0;
    };

    return Array.from(rowEl.children)
        .filter((el) => hasIndex(el) || hasIndex(el.firstChild))
        .sort((a, b) => getIndex(a) - getIndex(b));
}

/**
 * Creates the masonry layout by organizing elements one by one in the
 * shortest column.
 *
 * @param {Element} rowEl - The row element containing the items to organize
 * @param {number} desktopColumns - Number of columns for desktop view
 * @param {number} mobileColumns - Number of columns for mobile view
 * @returns {Promise} Resolves when all images are loaded and placed
 */
async function _createMasonryLayout(rowEl, desktopColumns, mobileColumns) {
    if (!rowEl) {
        return Promise.resolve();
    }

    const originalElements = _getOriginalElements(rowEl);
    if (!originalElements.length) {
        return Promise.resolve();
    }

    // Clear row and create masonry columns
    rowEl.innerHTML = "";
    const columnEls = _createColumnElements(desktopColumns, mobileColumns);
    columnEls.forEach((col) => rowEl.appendChild(col));
    rowEl.classList.add(MASONRY.CLASSES.MODE, MASONRY.CLASSES.FIXED_COLUMNS);

    // Distribute items across the columns
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
        const originallyHiddenItems = [];
        for (const element of originalElements) {
            element.classList.add(MASONRY.CLASSES.ITEM);
            const shortestColumn = _getShortestColumn(columnEls);
            const clonedItem = element.cloneNode(true);
            if (clonedItem.classList.contains("d-none")) {
                clonedItem.classList.remove("d-none");
                clonedItem.classList.add("opacity-0");
                originallyHiddenItems.push(clonedItem);
            }
            shortestColumn.appendChild(clonedItem);

            // wait for images to load to get correct column height
            // TODO: move onceAllImagesLoaded in web_editor and to use it here
            const imageEls = shortestColumn.querySelectorAll("img");
            await Promise.all(
                Array.from(imageEls).map((imgEl) => {
                    return new Promise((resolve) => {
                        if (imgEl.complete) {
                            resolve();
                        } else {
                            imgEl.onload = () => resolve();
                        }
                    });
                })
            );
        }
        for (const item of originallyHiddenItems) {
            item.classList.add("d-none");
            item.classList.remove("opacity-0");
        }
        resolve();
    });
}

/**
 * Toggles the masonry layout mode for the given container element.
 * Ensures the container has a `.row` element, which acts as the parent for
 * masonry items.
 * Any existing layout is cleared before re-initializing masonry layout.
 *
 * @public
 * @param {Element} containerEl - Element with the class "container", consisting
 *                                of a child with the class "row" that holds all
 *                                the masonry items.
 * @returns {Promise} Resolves when all images are loaded and placed
 */
export async function toggleMasonryMode(containerEl) {
    if (!containerEl) {
        return Promise.resolve();
    }

    let rowEl = containerEl.querySelector(":scope > .row");
    const outOfRowEls = [...containerEl.children].filter((el) => !el.classList.contains("row"));

    // Clear existing masonry layout if present
    if (rowEl) {
        if (rowEl.classList.contains(MASONRY.CLASSES.MODE)) {
            clearMasonryLayout(rowEl);
        } else if (rowEl.classList.contains(MASONRY.CLASSES.GRID)) {
            rowEl.classList.remove(MASONRY.CLASSES.GRID);
        }
    }

    // Create row if needed
    if (!rowEl) {
        rowEl = document.createElement("div");
        rowEl.classList.add("row");
        [...containerEl.children].forEach((child) => rowEl.appendChild(child));
        containerEl.appendChild(rowEl);
    }

    // Add out-of-row elements to row
    outOfRowEls.forEach((el) => rowEl.appendChild(el));

    const { desktop: desktopColumns, mobile: mobileColumns } = _getColumnConfiguration(containerEl);
    await _createMasonryLayout(rowEl, desktopColumns, mobileColumns);
}

/**
 * Clears the masonry layout
 *
 * @public
 * @param {Element} rowEl - The row element containing the masonry layout
 */
export function clearMasonryLayout(rowEl) {
    if (!rowEl) {
        return;
    }

    rowEl.classList.remove(MASONRY.CLASSES.MODE, MASONRY.CLASSES.FIXED_COLUMNS);

    const originalElements = [];
    rowEl.querySelectorAll(`.${MASONRY.CLASSES.COLUMN}`).forEach((col) => {
        originalElements.push(...col.children);
        col.remove();
    });

    originalElements.forEach((element) => rowEl.appendChild(element));
}

/**
 * Updates the column configuration for a container
 *
 * @public
 * @param {Element} containerEl - The container element
 * @param {Object} config - Configuration object
 * @param {number} [config.desktopColumns] - Number of columns for desktop view
 * @param {number} [config.mobileColumns] - Number of columns for mobile view
 */
export function updateMasonryConfig(containerEl, { desktopColumns, mobileColumns } = {}) {
    if (desktopColumns !== undefined) {
        containerEl.setAttribute(MASONRY.DATA_ATTRS.DESKTOP_COLUMNS, desktopColumns);
    }
    if (mobileColumns !== undefined) {
        containerEl.setAttribute(MASONRY.DATA_ATTRS.MOBILE_COLUMNS, mobileColumns);
    }

    // Reapply masonry layout if it's already active
    const rowEl = containerEl.querySelector(":scope > .row");
    if (rowEl && rowEl.classList.contains(MASONRY.CLASSES.MODE)) {
        toggleMasonryMode(containerEl);
    }
}

/**
 * Creates a resize observer for automatically updating masonry layout when the
 * screen size changes.
 *
 * @public
 * @param {Element} sectionEl - The section element to observe
 * @param {number} [debounceTime=100] - Debounce time in milliseconds
 * @returns {ResizeObserver} The resize observer instance
 */
export function observeMasonryContainerResize(sectionEl, debounceTime = 100) {
    if (!sectionEl) {
        return null;
    }

    const masonryRowEl = sectionEl.querySelector(`.${MASONRY.CLASSES.MODE}`);
    if (!masonryRowEl) {
        return null;
    }

    const resizeObserver = new ResizeObserver(
        debounce(toggleMasonryMode.bind(this, sectionEl.querySelector(".container")), debounceTime)
    );
    resizeObserver.observe(masonryRowEl);
    return resizeObserver;
}
