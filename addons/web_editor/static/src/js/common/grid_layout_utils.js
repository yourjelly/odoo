/** @odoo-module **/
'use strict';

import {qweb} from 'web.core';
const rowSize = 50; // 50px.

/**
 * Returns the grid properties: rowGap, rowSize, columnGap and columnSize.
 *
 * @private
 * @param {Element} rowEl the grid element
 * @returns {Object}
 */
export function _getGridProperties(rowEl) {
    const style = window.getComputedStyle(rowEl);
    const rowGap = parseFloat(style.rowGap);
    const columnGap = parseFloat(style.columnGap);
    const columnSize = (rowEl.clientWidth - 11 * columnGap) / 12;
    return {rowGap: rowGap, rowSize: rowSize, columnGap: columnGap, columnSize: columnSize};
}
/**
 * Sets the z-index property of the element to the maximum z-index present in
 * the grid increased by one (so it is in front of all the other elements).
 *
 * @private
 * @param {Element} element the element of which we want to set the z-index
 * @param {Element} rowEl the parent grid element of the element
 */
export function _setElementToMaxZindex(element, rowEl) {
    const childrenEls = [...rowEl.children].filter(el => el !== element);
    element.style.zIndex = Math.max(...childrenEls.map(el => el.style.zIndex)) + 1;
}
/**
 * Creates the background grid appearing everytime a change occurs in a grid.
 *
 * @private
 * @param {Element} rowEl
 * @param {Number} gridHeight
 */
export function _addBackgroundGrid(rowEl, gridHeight) {
    const gridProp = _getGridProperties(rowEl);
    const rowCount = Math.max(rowEl.dataset.rowCount, gridHeight);

    const backgroundGrid = qweb.render('web_editor.background_grid', {
        rowCount: rowCount + 1, rowGap: gridProp.rowGap, rowSize: gridProp.rowSize,
        columnGap: gridProp.columnGap, columnSize: gridProp.columnSize,
    });
    rowEl.insertAdjacentHTML("afterbegin", backgroundGrid);
    return rowEl.firstElementChild;
}
/**
 * Updates the number of rows in the grid to the end of the lowest column
 * present in it.
 *
 * @private
 * @param {Element} rowEl
 */
export function _resizeGrid(rowEl) {
    const columnEls = [...rowEl.children].filter(c => c.classList.contains('o_grid_item'));
    rowEl.dataset.rowCount = Math.max(...columnEls.map(el => el.style.gridRowEnd)) - 1;
}
/**
 * Removes the properties and elements added to make the drag work.
 *
 * @private
 * @param {Element} rowEl
 * @param {Element} column
 */
export function _gridCleanUp(rowEl, columnEl) {
    columnEl.style.removeProperty('position');
    columnEl.style.removeProperty('top');
    columnEl.style.removeProperty('left');
    columnEl.style.removeProperty('height');
    columnEl.style.removeProperty('width');
    rowEl.style.removeProperty('position');
}
/**
 * Toggles the row (= child element of containerEl) in grid mode.
 *
 * @private
 * @param {Element} containerEl element with the class "container"
 */
export function _toggleGridMode(containerEl) {
    let rowEl = containerEl.querySelector('.row');
    // For the snippets having text outside of the row (and therefore not in a
    // column), create a column and put the text in it so it can also be placed
    // in the grid.
    const snippetsToPreprocess = '.s_picture, .s_product_catalog, .s_references';
    const preprocess = containerEl.closest(snippetsToPreprocess);
    if (preprocess && rowEl) {
        const textEls = [...containerEl.children].filter(el => el.nodeName !== 'DIV');
        if (textEls.length > 0) {
            const columnEl = document.createElement('div');
            columnEl.classList.add('col-lg-12');
            for (let i = textEls.length - 1; i >= 0; i--) {
                columnEl.prepend(textEls[i]);
            }
            rowEl.prepend(columnEl);
        }
    }

    // If the number of columns is "None", create a column with the content.
    if (!rowEl) {
        rowEl = document.createElement('div');
        rowEl.classList.add('row');

        const columnEl = document.createElement('div');
        columnEl.classList.add('col-lg-12');

        const containerChildren = containerEl.children;
        // Looping backwards because elements are removed, so the indexes are
        // not lost.
        for (let i = containerChildren.length - 1; i >= 0; i--) {
            columnEl.prepend(containerChildren[i]);
        }
        rowEl.appendChild(columnEl);
        containerEl.appendChild(rowEl);
    }

    // Converting the columns to grid and getting back the number of rows.
    const columnEls = rowEl.children;
    const columnSize = (rowEl.clientWidth) / 12;
    rowEl.style.position = 'relative';
    const rowCount = _placeColumns(columnEls, rowSize, 0, columnSize, 0) - 1;
    rowEl.style.removeProperty('position');
    rowEl.dataset.rowCount = rowCount;

    // Removing the classes that break the grid.
    const classesToRemove = [...rowEl.classList].filter(c => {
        return /^align-items/.test(c);
    });
    rowEl.classList.remove(...classesToRemove);

    rowEl.classList.add('o_grid_mode');
}
/**
 * Places each column in the grid based on their position and returns the
 * lowest row end.
 *
 * @private
 * @param {HTMLCollection} columnEls
 *      The children of the row element we are toggling in grid mode.
 * @param {Number} rowSize
 * @param {Number} rowGap
 * @param {Number} columnSize
 * @param {Number} columnGap
 * @returns {Number}
 */
function _placeColumns(columnEls, rowSize, rowGap, columnSize, columnGap) {
    let maxRowEnd = 0;
    const columnSpans = [];
    const columnCount = columnEls.length; // number of column in the grid.
    const isBigBoxes = columnEls[0].closest('section.s_color_blocks_2');
    const imageColumns = []; // array of boolean telling if it is a column with only an image.

    for (const columnEl of columnEls) {
        // Finding out if the images are alone in their column so they can be
        // displayed as expected (thanks to the class that will be added).
        let isImageColumn = false;
        const imageEls = columnEl.querySelectorAll(':scope > img');
        const columnChildren = [...columnEl.children].filter(el => el.nodeName !== 'BR');
        if (imageEls.length === 1 && columnChildren.length === 1) {
            // If there is only one image and if this image is the only "real"
            // child of the column, we need to check if there is text in it.
            const textNodeEls = [...columnEl.childNodes].filter(el => el.nodeType === 3);
            const areTextNodesEmpty = [...textNodeEls].every(textNodeEl => textNodeEl.nodeValue.trim() === '');
            isImageColumn = areTextNodesEmpty;
        }

        // Placing the column.
        const style = window.getComputedStyle(columnEl);
        // Horizontal placement.
        const columnLeft = isImageColumn ? imageEls[0].offsetLeft : columnEl.offsetLeft;
        // Getting the width of the column.
        const paddingLeft = parseFloat(style.paddingLeft);
        const width = isImageColumn ? parseFloat(imageEls[0].scrollWidth)
            : parseFloat(columnEl.scrollWidth) - (isBigBoxes ? 0 : 2 * paddingLeft);
        let columnSpan = Math.round((width + columnGap) / (columnSize + columnGap));
        if (columnSpan < 1) {
            columnSpan = 1;
        }
        const columnStart = Math.round(columnLeft / (columnSize + columnGap)) + 1;
        const columnEnd = columnStart + columnSpan;

        // Vertical placement.
        const columnTop = isImageColumn ? imageEls[0].offsetTop : columnEl.offsetTop;
        // Getting the top and bottom paddings and computing the row offset.
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);
        const rowOffsetTop = Math.floor((paddingTop + rowGap) / (rowSize + rowGap));
        // Getting the height of the column.
        const height = isImageColumn ? parseFloat(imageEls[0].scrollHeight)
            : parseFloat(columnEl.scrollHeight) - (isBigBoxes ? 0 : paddingTop + paddingBottom);
        const rowSpan = Math.ceil((height + rowGap) / (rowSize + rowGap));
        const rowStart = Math.round(columnTop / (rowSize + rowGap)) + 1 + (isBigBoxes || isImageColumn ? 0 : rowOffsetTop);
        const rowEnd = rowStart + rowSpan;

        columnEl.style.gridArea = `${rowStart} / ${columnStart} / ${rowEnd} / ${columnEnd}`;
        columnEl.classList.add('o_grid_item');

        // Removing the grid classes (since they end with 0) and adding the
        // correct ones.
        const regex = /^(g-)/;
        const toRemove = [...columnEl.classList].filter(c => {
            return regex.test(c);
        });
        columnEl.classList.remove(...toRemove);
        columnEl.classList.add('g-col-lg-' + columnSpan, 'g-height-' + rowSpan);

        // Setting the initial z-index to the number of columns.
        columnEl.style.zIndex = columnCount;

        // Reload the images.
        _reloadLazyImages(columnEl);

        maxRowEnd = Math.max(rowEnd, maxRowEnd);
        columnSpans.push(columnSpan);
        imageColumns.push(isImageColumn);
    }

    // If we are in the Big Boxes snippet, set the padding of the grid items to
    // the original padding of the boxes so they look like in normal mode.
    if (isBigBoxes) {
        const style = window.getComputedStyle(columnEls[0]);
        const paddingY = style.paddingTop;
        const paddingX = style.paddingLeft;
        const rowEl = columnEls[0].parentNode;
        rowEl.style.setProperty('--grid-item-padding-y', paddingY);
        rowEl.style.setProperty('--grid-item-padding-x', paddingX);
    }

    for (const [i, columnEl] of [...columnEls].entries()) {
        // Removing padding and offset classes.
        const regex = /^(pt|pb|col-|offset-)/;
        const toRemove = [...columnEl.classList].filter(c => {
            return regex.test(c);
        });
        columnEl.classList.remove(...toRemove);
        columnEl.classList.add('col-lg-' + columnSpans[i]);

        // If the column only has an image, remove the line breaks and
        // textnodes, add the grid class and set the width to default.
        if (imageColumns[i]) {
            columnEl.querySelectorAll('br').forEach(el => el.remove());
            const textNodeEls = [...columnEl.childNodes].filter(el => el.nodeType === 3);
            textNodeEls.forEach(el => el.remove());
            const imageEl = columnEl.querySelector('img');
            imageEl.classList.add('o_grid_item_image');
            imageEl.style.removeProperty('width');
        }
    }

    return maxRowEnd;
}
/**
 * Removes and sets back the 'src' attribute of the images inside a column.
 * (To avoid the disappearing image problem in Chrome).
 *
 * @private
 * @param {Element} columnEl
 */
export function _reloadLazyImages(columnEl) {
    const imageEls = columnEl.querySelectorAll('img');
    for (const imageEl of imageEls) {
        const src = imageEl.src;
        imageEl.src = '';
        imageEl.src = src;
    }
}
/**
 * Computes the column and row spans of the column thanks to its width and
 * height and returns them. Also adds the grid classes to the column.
 *
 * @private
 * @param {Element} rowEl
 * @param {Element} columnEl
 * @param {Number} columnWidth the width in pixels of the column.
 * @param {Number} columnHeight the height in pixels of the column.
 * @returns {Object}
 */
export function _convertColumnToGrid(rowEl, columnEl, columnWidth, columnHeight) {
    // Computing the column and row spans.
    const gridProp = _getGridProperties(rowEl);
    const columnColCount = Math.round((columnWidth + gridProp.columnGap) / (gridProp.columnSize + gridProp.columnGap));
    const columnRowCount = Math.ceil((columnHeight + gridProp.rowGap) / (gridProp.rowSize + gridProp.rowGap));

    // Adding the grid classes.
    columnEl.classList.add('g-col-lg-' + columnColCount, 'g-height-' + columnRowCount);
    columnEl.classList.add('o_grid_item');

    return {columnColCount: columnColCount, columnRowCount: columnRowCount};
}
