odoo.define('web.BrowserDetection', function (require) {
    "use strict";
    var Class = require('web.Class');

    var BrowserDetection = Class.extend({
        init: function () {

        },
        isOsMac: function () {
            return navigator.platform.toLowerCase().indexOf('mac') !== -1;
        },
        isBrowserChrome: function () {
            return $.browser.chrome && // depends on jquery 1.x, removed in jquery 2 and above
                navigator.userAgent.toLocaleLowerCase().indexOf('edge') === -1; // as far as jquery is concerned, Edge is chrome
        },
        getBrowser: function (){
            var agent = window.navigator.userAgent.toLowerCase();
            switch (true){
                case agent.indexOf("edge") > -1: return "edge";
                case agent.indexOf("opr") > -1 && !!window.opr: return "opera";
                case agent.indexOf("chrome") > -1 && !!window.chrome: return "chrome";
                case agent.indexOf("trident") > -1: return "ie";
                case agent.indexOf("firefox") > -1: return "firefox";
                case agent.indexOf("safari") > -1: return "safari";
                default: return "other";
            }
        },

    });
    return BrowserDetection;
});
