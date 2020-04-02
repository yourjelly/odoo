odoo.define('point_of_sale.ClientLine', function(require) {
    'use strict';

    const PosComponent = require('point_of_sale.PosComponent');
    const ClientListScreen = require('point_of_sale.ClientListScreen');
    const Registry = require('point_of_sale.ComponentsRegistry');

    class ClientLine extends PosComponent {
        static template = 'ClientLine';
        get highlight() {
            if (this.props.partner !== this.props.selectedClient) {
                return '';
            } else {
                return this.props.detailIsShown ? 'highlight' : 'lowlight';
            }
        }
    }

    ClientListScreen.addComponents([ClientLine]);
    Registry.add(ClientLine);

    return ClientLine;
});
