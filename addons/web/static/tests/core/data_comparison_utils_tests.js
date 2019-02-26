odoo.define('web.data_comparison_utils_tests', function(require) {
"use strict";

var dataComparisonUtils = require('web.dataComparisonUtils');
var DateClasses = dataComparisonUtils.DateClasses;

QUnit.module('dataComparisonUtils', function () {

    QUnit.module('DateClasses');


    QUnit.test('main parameters are correctly computed', function(assert) {
        assert.expect(24);

        var dateClasses;

        dateClasses = new DateClasses([['2019']], 'year');
        assert.strictEqual(dateClasses._maximalLength, 1);
        assert.strictEqual(dateClasses.referenceIndex, 0);
        assert.deepEqual(dateClasses._referenceSet, ['2019']);
        assert.deepEqual(dateClasses._dateClasses, [['2019']]);

        dateClasses = new DateClasses([['2018', '2019']], 'year');
        assert.strictEqual(dateClasses._maximalLength, 2);
        assert.strictEqual(dateClasses.referenceIndex, 0);
        assert.deepEqual(dateClasses._referenceSet, ['2018', '2019']);
        assert.deepEqual(dateClasses._dateClasses, [['2018'], ['2019']]);

        dateClasses = new DateClasses([['2019'], []], 'year');
        assert.strictEqual(dateClasses._maximalLength, 1);
        assert.strictEqual(dateClasses.referenceIndex, 0);
        assert.deepEqual(dateClasses._referenceSet, ['2019']);
        assert.deepEqual(dateClasses._dateClasses, [['2019', undefined]]);

        dateClasses = new DateClasses([[], ['2019']], 'year');
        assert.strictEqual(dateClasses._maximalLength, 1);
        assert.strictEqual(dateClasses.referenceIndex, 1);
        assert.deepEqual(dateClasses._referenceSet, ['2019']);
        assert.deepEqual(dateClasses._dateClasses, [[undefined, '2019']]);

        dateClasses = new DateClasses([['2019'],['2018', '2019']], 'year');
        assert.strictEqual(dateClasses._maximalLength, 2);
        assert.strictEqual(dateClasses.referenceIndex, 0);
        assert.deepEqual(dateClasses._referenceSet, ['2019', '2020']);
        assert.deepEqual(dateClasses._dateClasses, [['2019', '2018'],['2020', '2019']]);

        dateClasses = new DateClasses([['2019'], ['2017', '2018', '2020'], ['2017', '2019']], 'year');
        assert.strictEqual(dateClasses._maximalLength, 3);
        assert.strictEqual(dateClasses.referenceIndex, 0);
        assert.deepEqual(dateClasses._referenceSet, ['2019', '2020', '2021']);
        assert.deepEqual(dateClasses._dateClasses, [['2019', '2017', '2017'], ['2020', '2018', '2019'], ['2021', '2020', undefined]]);

    });

    QUnit.test('dates in reference set have the right format', function(assert) {
        assert.expect(5);

        var dateClasses;

        dateClasses = new DateClasses([['05 March 2019'], ['?', '?']], 'day');
        assert.deepEqual(dateClasses._referenceSet, ['05 March 2019', '06 March 2019']);

        // not nice! Problem with local format too!
        dateClasses = new DateClasses([['W10 2019'], ['?', '?']], 'week');
        assert.deepEqual(dateClasses._referenceSet, ['W10 2019', '11 2019']);

        dateClasses = new DateClasses([['March 2019'], ['?', '?']], 'month');
        assert.deepEqual(dateClasses._referenceSet, ['March 2019', 'April 2019']);

        // not nice! Problem with local format too!
        dateClasses = new DateClasses([['Q1 2019'], ['?', '?']], 'quarter');
        assert.deepEqual(dateClasses._referenceSet, ['Q1 2019', '2 2019']);

        dateClasses = new DateClasses([['2019'], ['?', '?']], 'year');
        assert.deepEqual(dateClasses._referenceSet, ['2019', '2020']);

    });

    QUnit.test('two overlapping datesets and classes representatives', function(assert) {
        assert.expect(4);

        var dateClasses = new DateClasses([['March 2017'], ['February 2017', 'March 2017']], 'month');

        assert.strictEqual(dateClasses.representative(0, 'March 2017'), 'March 2017');
        assert.strictEqual(dateClasses.representative(0, 'March 2017', 1), 'February 2017');

        assert.strictEqual(dateClasses.representative(1, 'March 2017'), 'April 2017');
        assert.strictEqual(dateClasses.representative(1, 'March 2017', 1), 'March 2017');
    });
});
});
