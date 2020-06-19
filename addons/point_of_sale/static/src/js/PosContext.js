odoo.define('point_of_sale.PosContext', function (require) {
    'use strict';

    const { Context } = owl;

    // append several contexts to env
    function setupContexts(component) {
        component.env.orderManagement = new Context({ searchString: '', selectedOrder: null, numberSelectedLines: 0 });
        component.env.chrome = new Context({ showOrderSelector: true });
        // e.g. component.env.device = new Context({ isMobile: false });
    }

    return setupContexts;
});
