(function () {
    'use strict';
    if (navigator.serviceWorker) {
        navigator.serviceWorker.register('/service_worker.js', {
            scope: window.location.pathname,
        }).then(function (registration) {
            console.info('ServiceWorker registration successful with scope:', registration.scope);
        }).catch(function (error) {
            console.warn('ServiceWorker registration failed:', error);
        });
    }
})();
