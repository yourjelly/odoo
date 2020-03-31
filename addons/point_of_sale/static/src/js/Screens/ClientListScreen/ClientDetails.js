odoo.define('point_of_sale.ClientDetails', function(require) {
    'use strict';

    const { PosComponent, addComponents } = require('point_of_sale.PosComponent');
    const { ClientListScreen } = require('point_of_sale.ClientListScreen');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class ClientDetails extends PosComponent {
        static template = 'ClientDetails';
        get partnerImageUrl() {
            if (this.props.partner) {
                return `/web/image?model=res.partner&id=${this.props.partner.id}&field=image_128`;
            } else {
                return false;
            }
        }
    }

    addComponents(ClientListScreen, [ClientDetails]);
    Registry.add('ClientDetails', ClientDetails);

    return { ClientDetails };
});
