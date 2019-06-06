(function () {
'use strict';

var userAgent = navigator.userAgent;
var isEdge = /Edge\/\d+/.test(userAgent);

we3.options = {
    env: {
        isMac: navigator.appVersion.indexOf('Mac') > -1,
        isMSIE: /MSIE|Trident/i.test(userAgent),
        isEdge: isEdge,
        isFF: !isEdge && /firefox/i.test(userAgent),
        isPhantom: /PhantomJS/i.test(userAgent),
        isWebkit: !isEdge && /webkit/i.test(userAgent),
        isChrome: !isEdge && /chrome/i.test(userAgent),
        isSafari: !isEdge && /safari/i.test(userAgent),
        isSupportTouch: (('ontouchstart' in window) ||
            (navigator.MaxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0)),
    },
    lang: 'en_US',
    loadTemplates: null,
    renderTemplate: null,
    translate: null,
    // size
    width: null,
    height: null,
    minHeight: 180,
};

})();
