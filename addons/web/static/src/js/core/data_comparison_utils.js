odoo.define('web.dataComparisonUtils', function (require) {
"use strict";

var fieldUtils = require('web.field_utils');
var Class = require('web.Class');

var DateClasses = Class.extend({
    init: function (dateSets, interval) {
        interval = interval || 'month';
        this._formats = {
            day: 'DD MMMM YYYY',
            week: 'ww YYYY',
            month: 'MMMM YYYY',
            quarter: 'Q YYYY',
            year: 'YYYY',
        };
        // At least one dateSet must be non empty.
        // The completion of the first inhabited dateSet will serve as a reference set.
        // The reference set elements will be the default representatives for the classes.
        this._maximalLength = 1;
        this.referenceIndex = null;
        for (var i = 0; i < dateSets.length; i++) {
            var dateSet = dateSets[i];
            if (dateSet.length && this.referenceIndex === null) {
                this.referenceIndex = i;
            }
            if (dateSet.length > this._maximalLength) {
                this._maximalLength = dateSet.length;
            }
        }
        this._referenceSet = this._contructReferenceSet(dateSets[this.referenceIndex], interval);
        this._dateClasses = this._constructDateClasses(dateSets);
    },

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    dateClass: function (datesetIndex, date) {
        var dateClass;
        for (var i = 0; i < this._dateClasses.length; i++) {
            dateClass = this._dateClasses[i];
            if (dateClass[datesetIndex] === date) {
                break;
            }
        }
        return dateClass;
    },
    representative: function (datesetIndex, date, index) {
        index = index || this.referenceIndex;
        return this.dateClass(datesetIndex, date)[index];
    },

    //----------------------------------------------------------------------
    // Private
    //----------------------------------------------------------------------

    /**
     * @param {moment[]} dateSet, ordered dateSet
     * @param {number} num, indicates number of dates to add
     * @param {string} interval, determines time interval between two added dates
     * @returns {function}
     */
    _contructReferenceSet: function (dateSet, interval) {
        var additionalDates = [];
        var dateSetLength = dateSet.length;
        var diff = this._maximalLength - dateSetLength;
        var lastDate = dateSet[dateSetLength - 1];
        for (var i = 0; i < diff; i++) {
            // should choose appropriate format according to interval
            // do not work in general (--> local format)!
            var date = moment(lastDate, this._formats[interval]).add(i + 1, interval).format(this._formats[interval]);
            additionalDates.push(date);
        }
        return dateSet.concat(additionalDates);
    },
    _constructDateClasses: function (dateSets) {
        var dateClasses = [];
        for (var index = 0; index < this._maximalLength; index++) {
            var dateClass = [];
            for (var j = 0; j < dateSets.length; j++) {
                var dateSet = j === this.referenceIndex ? this._referenceSet : dateSets[j];
                if (index < dateSet.length) {
                    dateClass.push(dateSet[index]);
                } else {
                    dateClass.push(undefined);
                }
            }
            dateClasses.push(dateClass);
        }
        return dateClasses;
    },
});
/**
 * @param {Number} value
 * @param {Number} comparisonValue
 * @returns {Object}
 */
function computeVariation (value, comparisonValue) {
    var magnitude;
    var signClass;

    if (!isNaN(value) && !isNaN(comparisonValue)) {
        if (comparisonValue === 0) {
            if (value === 0) {
                magnitude = 0;
            } else if (value > 0){
                magnitude = 1;
            } else {
                magnitude = -1;
            }
        } else {
            magnitude = (value - comparisonValue) / Math.abs(comparisonValue);
        }
        if (magnitude > 0) {
            signClass = ' o_positive';
        } else if (magnitude < 0) {
            signClass = ' o_negative';
        } else if (magnitude === 0) {
            signClass = ' o_null';
        }
        return {magnitude: magnitude, signClass: signClass};
    } else {
        return {magnitude: NaN};
    }
}
/**
 * @param {Object} variation
 * @param {Object} field
 * @param {Object} options
 * @returns {Object}
 */
function renderVariation (variation, field, options) {
    var $variation;
    if (!isNaN(variation.magnitude)) {
        $variation = $('<div>', {class: 'o_variation' + variation.signClass}).html(
            fieldUtils.format.percentage(variation.magnitude, field, options
        ));
    } else {
        $variation = $('<div>', {class: 'o_variation'}).html('-');
    }
    return $variation;
}
/**
 * @param {JQuery} $node
 * @param {Number} value
 * @param {Number} comparisonValue
 * @param {Object} variation (with key 'magnitude' and 'signClass')
 * @param {function} formatter
 * @param {Object} field
 * @param {Object} options
 * @returns {Object}
 */
function renderComparison ($node, value, comparisonValue, variation, formatter, field, options) {
    var $variation = renderVariation(variation, field, options);
    $node.append($variation);
    if (!isNaN(variation.magnitude)) {
        $node.append(
            $('<div>', {class: 'o_comparison'})
            .html(formatter(value, field, options) + ' <span>vs</span> ' + formatter(comparisonValue, field, options))
        );
    }
}

return {
    computeVariation: computeVariation,
    DateClasses: DateClasses,
    renderComparison: renderComparison
};

});
