odoo.define('pos_restaurant.test_mock_data', function (require) {
    'use strict';

    const Registries = require('point_of_sale.Registries');
    const PosMockData = require('point_of_sale.test_mock_data');

    const POS_RESTAURANT_DATA = {
        'restaurant.table': [
            {
                id: 1,
                name: 'T1',
                width: 100,
                height: 100,
                position_h: 50,
                position_v: 50,
                shape: 'square',
                floor_id: [1, 'Main Floor'],
                color: 'rgb(53,211,116)',
                seats: 4,
            },
        ],
    };

    const PosResMockData = (PosMockData) =>
        class extends PosMockData {
            getData(model) {
                const result = super.getData(model);
                if (result.length) {
                    return result;
                } else {
                    return POS_RESTAURANT_DATA[model] || [];
                }
            }
        };

    Registries.Class.extend(PosMockData, PosResMockData);

    return PosMockData;
});
