odoo.define('rating.rating_test', function (require) {
    "use strict";

var rating = require('rating.rating');
var testUtils = require('web.test_utils');
var ajax = require('web.ajax');
var core = require('web.core');
var qweb = core.qweb;

ajax.loadXML('/rating/static/src/xml/rating_common.xml', qweb);

QUnit.module('rating', {}, function () {

QUnit.test('Rating Test', function (assert) {
    assert.expect(1);
    var ratingstarwidget = new rating.RatingStarWidget();
    ratingstarwidget.appendTo($('#qunit-fixture'));
    ratingstarwidget.$('.stars i').eq( 2 ).trigger('mousemove').trigger('click');
    assert.equal(ratingstarwidget.$('.stars').find('.fa-star').length, 3, "3 Star Rating" );
});
});
});
