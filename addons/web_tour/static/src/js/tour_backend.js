odoo.define('web_tour.tour', function(require) {
"use strict";

var core = require('web.core');
var Tour = require('web_tour.Tour');

// select the target node
// var target = document.body;
 
// create an observer instance
// var observer = new MutationObserver(function(mutations) {
//   mutations.forEach(function(mutation) {
//     console.log(mutation.type);
//   });    
// });
 
// configuration of the observer:
 
// pass in the target node, as well as the observer options
 
// later, you can stop observing
// observer.disconnect();


Tour.include({
    init: function() {
        this._super();
        // core.bus.on('DOM_updated', this, this.check_for_tooltip);
        // core.bus.on('click', this, this.check_for_tooltip);
        var observer = new MutationObserver(this.check_for_tooltip.bind(this));
        var config = { attributes: true, childList: true, characterData: true };
        document.addEventListener("DOMContentLoaded", function(event) {
            observer.observe(document.body, config);
        });
    },
});

return new Tour();

});
