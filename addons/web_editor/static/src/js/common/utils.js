odoo.define('web_editor.utils', function (require) {
'use strict';

const {ColorpickerWidget} = require('web.Colorpicker');

/**
 * window.getComputedStyle cannot work properly with CSS shortcuts (like
 * 'border-width' which is a shortcut for the top + right + bottom + left border
 * widths. If an option wants to customize such a shortcut, it should be listed
 * here with the non-shortcuts property it stands for, in order.
 *
 * @type {Object<string[]>}
 */
const CSS_SHORTHANDS = {
    'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
    'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
    'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
    'border-style': ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
};
/**
 * Key-value mapping to list converters from an unit A to an unit B.
 * - The key is a string in the format '$1-$2' where $1 is the CSS symbol of
 *   unit A and $2 is the CSS symbol of unit B.
 * - The value is a function that converts the received value (expressed in
 *   unit A) to another value expressed in unit B. Two other parameters is
 *   received: the css property on which the unit applies and the jQuery element
 *   on which that css property may change.
 */
const CSS_UNITS_CONVERSION = {
    's-ms': () => 1000,
    'ms-s': () => 0.001,
    'rem-px': () => _computePxByRem(),
    'px-rem': () => _computePxByRem(true),
};

/**
 * Computes the number of "px" needed to make a "rem" unit. Subsequent calls
 * returns the cached computed value.
 *
 * @param {boolean} [toRem=false]
 * @returns {float} - number of px by rem if 'toRem' is false
 *                  - the inverse otherwise
 */
function _computePxByRem(toRem) {
    if (_computePxByRem.PX_BY_REM === undefined) {
        const htmlStyle = window.getComputedStyle(document.documentElement);
        _computePxByRem.PX_BY_REM = parseFloat(htmlStyle['font-size']);
    }
    return toRem ? (1 / _computePxByRem.PX_BY_REM) : _computePxByRem.PX_BY_REM;
}
/**
 * Converts the given (value + unit) string to a numeric value expressed in
 * the other given css unit.
 *
 * e.g. fct('400ms', 's') -> 0.4
 *
 * @param {string} value
 * @param {string} unitTo
 * @param {string} [cssProp] - the css property on which the unit applies
 * @param {jQuery} [$target] - the jQuery element on which that css property
 *                             may change
 * @returns {number}
 */
function _convertValueToUnit(value, unitTo, cssProp, $target) {
    const m = _getNumericAndUnit(value);
    if (!m) {
        return NaN;
    }
    const numValue = parseFloat(m[0]);
    const valueUnit = m[1];
    return _convertNumericToUnit(numValue, valueUnit, unitTo, cssProp, $target);
}
/**
 * Converts the given numeric value expressed in the given css unit into
 * the corresponding numeric value expressed in the other given css unit.
 *
 * e.g. fct(400, 'ms', 's') -> 0.4
 *
 * @param {number} value
 * @param {string} unitFrom
 * @param {string} unitTo
 * @param {string} [cssProp] - the css property on which the unit applies
 * @param {jQuery} [$target] - the jQuery element on which that css property
 *                             may change
 * @returns {number}
 */
function _convertNumericToUnit(value, unitFrom, unitTo, cssProp, $target) {
    if (Math.abs(value) < Number.EPSILON || unitFrom === unitTo) {
        return value;
    }
    const converter = CSS_UNITS_CONVERSION[`${unitFrom}-${unitTo}`];
    if (converter === undefined) {
        throw new Error(`Cannot convert '${unitFrom}' units into '${unitTo}' units !`);
    }
    return value * converter(cssProp, $target);
}
/**
 * Returns the numeric value and unit of a css value.
 *
 * e.g. fct('400ms') -> [400, 'ms']
 *
 * @param {string} value
 * @returns {Array|null}
 */
function _getNumericAndUnit(value) {
    const m = value.trim().match(/^(-?[0-9.]+)([A-Za-z% -]*)$/);
    if (!m) {
        return null;
    }
    return [m[1].trim(), m[2].trim()];
}
/**
 * Checks if two css values are equal.
 *
 * @param {string} value1
 * @param {string} value2
 * @param {string} [cssProp] - the css property on which the unit applies
 * @param {jQuery} [$target] - the jQuery element on which that css property
 *                             may change
 * @returns {boolean}
 */
function _areCssValuesEqual(value1, value2, cssProp, $target) {
    // If not colors, they will be left untouched
    value1 = ColorpickerWidget.normalizeCSSColor(value1);
    value2 = ColorpickerWidget.normalizeCSSColor(value2);

    // String comparison first
    if (value1 === value2) {
        return true;
    }

    // Convert the second value in the unit of the first one and compare
    // floating values
    const data = _getNumericAndUnit(value1);
    if (!data) {
        return false;
    }
    const numValue1 = data[0];
    const numValue2 = _convertValueToUnit(value2, data[1], cssProp, $target);
    return (Math.abs(numValue1 - numValue2) < Number.EPSILON);
}
/**
 * @param {string|number} name
 * @returns {boolean}
 */
function _isColorCombinationName(name) {
    const number = parseInt(name);
    return (!isNaN(number) && number % 100 !== 0);
}
/**
 * @param {string[]} colorNames
 * @param {string} [prefix='bg-']
 * @returns {string[]}
 */
function _computeColorClasses(colorNames, prefix = 'bg-') {
    let hasCCClasses = false;
    const isBgPrefix = (prefix === 'bg-');
    const classes = colorNames.map(c => {
        if (isBgPrefix && _isColorCombinationName(c)) {
            hasCCClasses = true;
            return `o_cc${c}`;
        }
        return (prefix + c);
    });
    if (hasCCClasses) {
        classes.push('o_cc');
    }
    return classes;
}
/**
 * Normalize a color in case it is a variable name so it can be used outside of
 * css.
 *
 * @param {string} color the color to normalize into a css value
 * @returns {string} the normalized color
 */
function normalizeColor(color) {
    if (!ColorpickerWidget.isCSSColor(color)) {
        const style = window.getComputedStyle(document.documentElement);
        color = style.getPropertyValue('--' + color).trim();
        color = ColorpickerWidget.normalizeCSSColor(color);
    }
    return color;
}
/**
 * Splits a CSS property into its respective parts, doesn't split between
 * parentheses. eg:
 *    splitCssValue("linear-gradient(to bottom, rgba(255,255,0,0.5), rgba(0,0,255,0.5)), url('/web/static/image.png')", ',')
 *    => ["linear-gradient(to bottom, rgba(255,255,0,0.5), rgba(0,0,255,0.5))", "url('/web/static/image.png')"]
 *
 * @param {string} cssValue the css property to split
 * @param {string} [delimiter=','] the delimiter on which to split
 */
function splitCssValue(cssValue, delimiter = ',') {
    const findClosingParen = (string, index) => {
        let balance = 1;
        while (balance !== 0 && ++index < string.length) {
            switch (string[index]) {
                case '(':
                    balance++;
                    break;
                case ')':
                    balance--;
                    break;
            }
        }
        return index;
    };

    const topLevelParens = [];
    for (let index = 0; index < cssValue.length; index++) {
        if (cssValue[index] === '(') {
            const closing = findClosingParen(cssValue, index);
            topLevelParens.push({start: index, stop: closing});
            index = closing;
        }
    }

    const inRanges = (index, ranges) => {
        return ranges.some(range => index >= range.start && index <= range.stop);
    };

    const parts = [];
    let i = 0;
    let previousDelimiter = -1;
    while (i < cssValue.length) {
        const nextDelimiter = cssValue.indexOf(delimiter, i);
        if (nextDelimiter < 0) {
            parts.push(cssValue.substring(previousDelimiter + 1).trim());
            break;
        }
        if (!inRanges(nextDelimiter, topLevelParens)) {
            parts.push(cssValue.substring(previousDelimiter + 1, nextDelimiter).trim());
            previousDelimiter = nextDelimiter;
        }
        i = nextDelimiter + 1;
    }
    return parts;
}
/**
 * Pads an array to a given length by repeating its contents.
 *     eg: padRepeat([1, 2, 3], 7) => [1, 2, 3, 1, 2, 3, 1]
 *
 * @param {Array} arr the array to pad
 * @param {Integer} length the length to which the array should be padded
 */
function padRepeat(arr, length) {
    // Pad empty arrays with empty strings.
    if (arr.length === 0) {
        arr = [''];
    }
    const ret = [];
    while (ret.length < length) {
        Array.prototype.push.apply(ret, arr.slice(0, length - ret.length));
    }
    return ret;
}
/**
 * Returns an array of an elements backgrounds with all their properties
 *
 * @param {HMTLElement} el the element whose backgrounds should be returned
 * @returns {Array} an array of background objects
 */
function getBackgrounds(el) {
    const $el = $(el);
    const nbBackgrounds = splitCssValue($el.css('background-image')).length;
    const backgroundComponents = [
        'background-image',
        'background-repeat',
        'background-attachment',
        'background-position',
        'background-clip',
        'background-origin',
        'background-size',
    ];
    // cssValues: [
    //     ["background-image", "url(...), linear-gradient(...)"],
    //     ["background-repeat", "repeat, no-repeat"],
    //     ...
    // ]
    const cssValues = Object.entries($el.css(backgroundComponents));
    // splitProps: [
    //     ["background-image", ["url(...)", "linear-gradient(..)"]],
    //     ["background-repeat", ["rapeat", "no-repeat"]],
    //     ...
    // ]
    // For why we use padRepeat, see https://www.w3.org/TR/css-backgrounds-3/#layering
    const splitProps = cssValues.map(([propName, propValue]) => [propName, padRepeat(splitCssValue(propValue), nbBackgrounds)]);
    // entriesArray: [
    //     [["background-image", "url(...)"], ["background-repeat", "repeat"], ...],
    //     [["background-image", "linear-gradient(...)"], ["background-repeat","no-repeat"], ...], ...
    //     ...
    // ]
    const entriesArray = _.zip(...splitProps.map(([propName, subValues]) => subValues.map(subValue => [propName, subValue])));
    // returned value: [
    //     {"background-image": "url(...)", "background-repeat": "repeat", ...},
    //     {"background-image": "linear-gradient(...)", "background-repeat": "no-repeat", ...},
    //     ...
    // ]
    return entriesArray.map(entries => Object.fromEntries(entries));
}
/**
 * Replace one of an element's backgrounds.
 *
 * @param {HTMLElement} el the element whose background should be changed.
 * @param {Function} findFn the function used in find to identify which
 *    background to change.
 * @param {Function} insertMethod the Array method that should be used to insert
 *    a new background if one wasn't found with findFn.
 * @param {Object} background an object with all the background's non-default
 *    properties.
 *    @see getBackgrounds for the complete list.
 */
function setBackground(el, findFn, insertMethod, background) {
    const backgroundDefaults = {
        'background-image': 'none',
        'background-repeat': 'repeat',
        'background-attachment': 'scroll',
        'background-position': '0% 0%',
        'background-clip': 'border-box',
        'background-origin': 'padding-box',
        'background-size': 'auto',
    };
    const backgrounds = getBackgrounds(el);
    let currentBackground = backgrounds.find(bg => findFn(bg['background-image']));
    if (!currentBackground) {
        currentBackground = {};
        insertMethod.call(backgrounds, currentBackground);
    }
    background = Object.assign({}, backgroundDefaults, currentBackground, background);
    Object.assign(currentBackground, background);
    const entries = backgrounds.filter(bg => bg['background-image'] !== 'none').map(bg => Object.entries(bg));
    if (entries.length === 0) {
        // No entries, need to override background properties with empty string
        entries.push(Object.entries(backgroundDefaults).map(([propName]) => [propName, '']));
    }
    const cssValues = _.zip(...entries)
        .map(propArray => [propArray[0][0], propArray.map(([, propValue]) => propValue).join(', ')]);
    $(el).css(Object.fromEntries(cssValues));
}
/**
 * Parse a background-image's src.
 *
 * @param {string} string a css value in the form 'url("...")'
 * @returns {string|false} the src of the image or false if not parsable
 */
function parseBgSrc(string) {
    const match = string.match(/^url\(['"](.*?)['"]\)$/);
    if (!match) {
        return false;
    }
    return match[1];
}
/**
 * Parse a background shape's src.
 *
 * @param {string} string a css value in the form 'url("...")'
 * @returns {string} the src of the shape or false if not parsable/not a shape
 */
function parseShapeSrc(string) {
    const src = parseBgSrc(string);
    const url = new URL(src, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/web_editor/shape/')) {
        return false;
    }
    return url.pathname + url.search;
}

const isShapeSrc = string => !!parseShapeSrc(string);
const isBgImageSrc = string => !!parseBgSrc(string) && !isShapeSrc(string);

const setBgImage = (el, background, noInsert) => {
    const insertMethod = !noInsert ? Array.prototype.push : () => undefined;
    setBackground(el, isBgImageSrc, insertMethod, background);
};
const getBgImage = el => getBackgrounds(el).find(bg => isBgImageSrc(bg['background-image']));
const getBgImageSrc = el => {
    const bg = getBgImage(el);
    return bg && parseBgSrc(bg['background-image']);
};

const setBgShape = (el, background) => setBackground(el, isShapeSrc, Array.prototype.unshift, background);
const getBgShape = el => getBackgrounds(el).find(bg => isShapeSrc(bg['background-image']));
const getBgShapeSrc = el => {
    const bg = getBgShape(el);
    return bg && parseShapeSrc(bg['background-image']);
};

return {
    CSS_SHORTHANDS: CSS_SHORTHANDS,
    CSS_UNITS_CONVERSION: CSS_UNITS_CONVERSION,
    computePxByRem: _computePxByRem,
    convertValueToUnit: _convertValueToUnit,
    convertNumericToUnit: _convertNumericToUnit,
    getNumericAndUnit: _getNumericAndUnit,
    areCssValuesEqual: _areCssValuesEqual,
    isColorCombinationName: _isColorCombinationName,
    computeColorClasses: _computeColorClasses,
    normalizeColor,
    setBgShape,
    setBgImage,
    getBgImage,
    getBgImageSrc,
    getBgShapeSrc,
};
});
