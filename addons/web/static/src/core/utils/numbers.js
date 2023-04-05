/** @odoo-module **/

/**
 * @param {number} value
 * @param {number} comparisonValue
 * @returns {number}
 */
export function computeVariation(value, comparisonValue) {
    if (isNaN(value) || isNaN(comparisonValue)) {
        return NaN;
    }
    if (comparisonValue === 0) {
        if (value === 0) {
            return 0;
        } else if (value > 0) {
            return 1;
        } else {
            return -1;
        }
    }
    return (value - comparisonValue) / Math.abs(comparisonValue);
}

/**
 * Returns value clamped to the inclusive range of min and max.
 *
 * @param {number} num
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(num, min, max) {
    return Math.max(Math.min(num, max), min);
}

/**
 * A function to create flexibly-numbered lists of integers, handy for each and map loops.
 * start, if omitted, defaults to 0;
 * step defaults to 1 if start is before stop, otherwise -1.
 * Returns a list of integers from start (inclusive) to stop (exclusive), incremented (or decremented) by step.
 * @param {number} min default 0
 * @param {number} max
 * @param {number} step default 1
 * @returns {number[]}
 */
export function range(start = 0, stop, step = 1) {
    const array = [];
    if (!stop) {
        stop = start;
        start = 0;
    }
    const nsteps = Math.floor((stop - start) / step);
    for (let i = 0; i < nsteps; i++) {
        array.push(start + step * i);
    }
    return array;
}
