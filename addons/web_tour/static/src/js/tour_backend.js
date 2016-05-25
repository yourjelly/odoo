odoo.define('web_tour.tour', function(require) {
"use strict";

var core = require('web.core');
var Tour = require('web_tour.Tour');

Tour.include({
    init: function() {
        this._super();
        core.bus.on('DOM_updated', this, this.check_for_tooltip);
    },
});

return new Tour();

});
