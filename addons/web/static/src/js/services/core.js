odoo.define('web.core', function (require) {
"use strict";

var Bus = require('web.Bus');
var Class = require('web.Class');
var mixins = require('web.mixins');
var QWeb = require('web.QWeb');
var Registry = require('web.Registry');
var translation = require('web.translation');

var debug = $.deparam($.param.querystring()).debug !== undefined;

var bus = new Bus ();

_.each('click,dblclick,keydown,keypress,keyup'.split(','), function(evtype) {
    $('html').on(evtype, function(ev) {
        bus.trigger(evtype, ev);
    });
});
_.each('resize,scroll'.split(','), function(evtype) {
    $(window).on(evtype, function(ev) {
        bus.trigger(evtype, ev);
    });
});

$(document).bind("keyup", "alt+/", function(e) {
    // We can remove usage of jquery hotkey by checking altkey=true and e.which == 191
    var accesskey_elements = $(document).find("[accesskey]").filter(":visible");
    _.each(accesskey_elements, function(elem) {
        $(_.str.sprintf("<div>%s</div>", $(elem).attr("accesskey").toUpperCase())).css({
            position: "absolute",
            width: "100%",
            height: "100%",
            left: 0,
            top: 0,
            zIndex: 1000000,  // to be on the safe side
            "background-color": "rgba(0,0,0,.7)",
            "padding-top": "5px",
            "color": "#FFFFFF"
        }).appendTo($(elem).css("position", "relative"));
    });
});

return {
    debug: debug,
    qweb: new QWeb(debug),

    // core classes and functions
    Class: Class,
    mixins: mixins,
    bus: bus,
    main_bus: new Bus(),
    _t: translation._t,
    _lt: translation._lt,

    // registries
    action_registry : new Registry(),
    crash_registry: new Registry(),
    form_custom_registry: new Registry(),
    form_tag_registry: new Registry(),
    form_widget_registry: new Registry(),
    list_widget_registry: new Registry(),
    one2many_view_registry: new Registry(),
    search_filters_registry: new Registry(),
    search_widgets_registry: new Registry(),
    view_registry: new Registry(),

    csrf_token: odoo.csrf_token,
};

});
