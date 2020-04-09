odoo.define('point_of_sale.ClientDetails', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const Registries = require('point_of_sale.Registries');

    class ClientDetails extends PosComponent {
        get partnerImageUrl() {
            if (this.props.partner) {
                return `/web/image?model=res.partner&id=${this.props.partner.id}&field=image_128`;
            } else {
                return false;
            }
        }
    }
    ClientDetails.template = 'ClientDetails';

    Registries.Component.add(ClientDetails);

    return ClientDetails;
});
