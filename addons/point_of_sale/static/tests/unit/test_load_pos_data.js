/** @odoo-module **/

export const loadPosData = {
    "res.company": {
        "id": 1,
        "currency_id": [
            2,
            "USD"
        ],
        "email": "info@yourcompany.com",
        "website": "http://www.example.com",
        "company_registry": false,
        "vat": false,
        "name": "My Company (San Francisco)",
        "phone": "+1 (650) 555-0111 ",
        "partner_id": [
            1,
            "My Company (San Francisco)"
        ],
        "country_id": [
            233,
            "United States"
        ],
        "state_id": [
            13,
            "California (US)"
        ],
        "tax_calculation_rounding_method": "round_per_line",
        "country": {
            "id": 233,
            "name": "United States",
            "vat_label": "EIN",
            "code": "US"
        }
    },
    "decimal.precision": {
        "Product Price": 2,
        "Discount": 2,
        "Stock Weight": 2,
        "Volume": 2,
        "Product Unit of Measure": 2,
        "Payment Terms": 6
    },
    "uom.uom": [
        {
            "id": 6,
            "name": "mm",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 1000.0,
            "factor_inv": 0.001,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "mm",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 13,
            "name": "g",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 1000.0,
            "factor_inv": 0.001,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "g",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 8,
            "name": "cm",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 100.0,
            "factor_inv": 0.01,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 100.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "cm",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 25,
            "name": "in\u00b3",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 61.0237,
            "factor_inv": 0.0163870758410257,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 61.0237,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "in\u00b3",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 17,
            "name": "in",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 39.3701,
            "factor_inv": 0.025399986284007407,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 39.3701,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "in",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 16,
            "name": "oz",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 35.274,
            "factor_inv": 0.02834949254408346,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 35.274,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "oz",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 22,
            "name": "fl oz (US)",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 33.814,
            "factor_inv": 0.029573549417401077,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 33.814,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "fl oz (US)",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 21,
            "name": "ft\u00b2",
            "category_id": [
                5,
                "Surface"
            ],
            "factor": 10.76391,
            "factor_inv": 0.09290304359661128,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 10.76391,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "ft\u00b2",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 4,
            "name": "Hours",
            "category_id": [
                3,
                "Working Time"
            ],
            "factor": 8.0,
            "factor_inv": 0.125,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 8.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "Hours",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 18,
            "name": "ft",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 3.28084,
            "factor_inv": 0.3047999902464003,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 3.28084,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "ft",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 15,
            "name": "lb",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 2.20462,
            "factor_inv": 0.45359290943563974,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 2.20462,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "lb",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 19,
            "name": "yd",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 1.09361,
            "factor_inv": 0.9144027578387177,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 1.09361,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "yd",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 23,
            "name": "qt (US)",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 1.05669,
            "factor_inv": 0.9463513423993792,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 1.05669,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "qt (US)",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 1,
            "name": "Units",
            "category_id": [
                1,
                "Unit"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "Units",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": true
        },
        {
            "id": 3,
            "name": "Days",
            "category_id": [
                3,
                "Working Time"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "Days",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 5,
            "name": "m",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "m",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 9,
            "name": "m\u00b2",
            "category_id": [
                5,
                "Surface"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "m\u00b2",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 10,
            "name": "L",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "L",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 12,
            "name": "kg",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "kg",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 24,
            "name": "gal (US)",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 0.26417217685798894,
            "factor_inv": 3.78541,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 3.78541,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "gal (US)",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 2,
            "name": "Dozens",
            "category_id": [
                1,
                "Unit"
            ],
            "factor": 0.08333333333333333,
            "factor_inv": 12.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 12.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "Dozens",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": true
        },
        {
            "id": 26,
            "name": "ft\u00b3",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 0.035314724827664144,
            "factor_inv": 28.316799999999997,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 28.316799999999997,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "ft\u00b3",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 7,
            "name": "km",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 0.001,
            "factor_inv": 1000.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "km",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 11,
            "name": "m\u00b3",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 0.001,
            "factor_inv": 1000.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "m\u00b3",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 14,
            "name": "t",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 0.001,
            "factor_inv": 1000.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "t",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        {
            "id": 20,
            "name": "mi",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 0.0006213727366498068,
            "factor_inv": 1609.34,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 1609.34,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "mi",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        }
    ],
    "res.country.state": [
        {
            "id": 963,
            "name": "Adana",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1171,
            "name": "Tarapac\u00e1",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 248,
            "name": "Aveiro",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 680,
            "name": "\u0410\u0440\u0445\u0430\u043d\u0433\u0430\u0439",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1384,
            "name": "Azuay",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 1146,
            "name": "Amazonas",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 212,
            "name": "Hokkaido",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1385,
            "name": "Bolivar",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 1147,
            "name": "\u00c1ncash",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 681,
            "name": "\u0411\u0430\u044f\u043d-\u04e8\u043b\u0433\u0438\u0439",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 249,
            "name": "Beja",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 203,
            "name": "Aomori",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1172,
            "name": "Antofagasta",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 964,
            "name": "Ad\u0131yaman",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 965,
            "name": "Afyon",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 682,
            "name": "\u0411\u0430\u044f\u043d\u0445\u043e\u043d\u0433\u043e\u0440",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1173,
            "name": "Atacama",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 1386,
            "name": "Canar",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 1148,
            "name": "Apur\u00edmac",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 216,
            "name": "Iwate",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 250,
            "name": "Braga",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 1387,
            "name": "Carchi",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 1174,
            "name": "Coquimbo",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 1149,
            "name": "Arequipa",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 224,
            "name": "Miyagi",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 251,
            "name": "Bragan\u00e7a",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 683,
            "name": "\u0411\u0443\u043b\u0433\u0430\u043d",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 966,
            "name": "A\u011fr\u0131",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 252,
            "name": "Castelo Branco",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 1388,
            "name": "Cotopaxi",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 967,
            "name": "Amasya",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1150,
            "name": "Ayacucho",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 1175,
            "name": "Valpara\u00edso",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 202,
            "name": "Akita",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 684,
            "name": "\u0413\u043e\u0432\u044c-\u0410\u043b\u0442\u0430\u0439",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 253,
            "name": "Coimbra",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 1389,
            "name": "Chimborazo",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 968,
            "name": "Ankara",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 685,
            "name": "\u0414\u043e\u0440\u043d\u043e\u0433\u043e\u0432\u044c",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 245,
            "name": "Yamagata",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1151,
            "name": "Cajamarca",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 1176,
            "name": "del Libertador Gral. Bernardo O'Higgins",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 254,
            "name": "\u00c9vora",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 686,
            "name": "\u0414\u043e\u0440\u043d\u043e\u0434",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1177,
            "name": "del Maule",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 1152,
            "name": "Callao",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 208,
            "name": "Fukushima",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1390,
            "name": "El Oro",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 969,
            "name": "Antalya",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 214,
            "name": "Ibaraki",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 970,
            "name": "Artvin",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 255,
            "name": "Faro",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 1391,
            "name": "Esmeraldas",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 1178,
            "name": "del B\u00edoBio",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 687,
            "name": "\u0414\u0443\u043d\u0434\u0433\u043e\u0432\u044c",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1153,
            "name": "Cusco",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 1154,
            "name": "Huancavelica",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 1179,
            "name": "de la Araucania",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 1392,
            "name": "Guayas",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 256,
            "name": "Guarda",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 971,
            "name": "Ayd\u0131n",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 688,
            "name": "\u0417\u0430\u0432\u0445\u0430\u043d",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 239,
            "name": "Tochigi",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1107,
            "name": "San Jos\u00e9",
            "country_id": [
                50,
                "Costa Rica"
            ]
        },
        {
            "id": 1393,
            "name": "Imbabura",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 1180,
            "name": "de los Lagos",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 210,
            "name": "Gunma",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1155,
            "name": "Hu\u00e1nuco",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 689,
            "name": "\u04e8\u0432\u04e9\u0440\u0445\u0430\u043d\u0433\u0430\u0439",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 972,
            "name": "Bal\u0131kesir",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 257,
            "name": "Leiria",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 258,
            "name": "Lisboa",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 1156,
            "name": "Ica",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 235,
            "name": "Saitama",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 973,
            "name": "Bilecik",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1181,
            "name": "Ays\u00e9n del Gral. Carlos Ib\u00e1\u00f1ez del Campo",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 690,
            "name": "\u04e8\u043c\u043d\u04e9\u0433\u043e\u0432\u044c",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1394,
            "name": "Loja",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 1182,
            "name": "Magallanes",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 259,
            "name": "Portalegre",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 1157,
            "name": "Junin",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 1395,
            "name": "Los Rios",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 974,
            "name": "Bing\u00f6l",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 691,
            "name": "\u0421\u04af\u0445\u0431\u0430\u0430\u0442\u0430\u0440",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 204,
            "name": "Chiba",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1396,
            "name": "Manabi",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 260,
            "name": "Porto",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 1158,
            "name": "La Libertad",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 1183,
            "name": "Metropolitana",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 243,
            "name": "Tokyo",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 975,
            "name": "Bitlis",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 692,
            "name": "\u0421\u044d\u043b\u044d\u043d\u0433\u044d",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 693,
            "name": "\u0422\u04e9\u0432",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1397,
            "name": "Morona Santiago",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 976,
            "name": "Bolu",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1159,
            "name": "Lambayeque",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 1184,
            "name": "Los R\u00edos",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 261,
            "name": "Santar\u00e9m",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 219,
            "name": "Kanagawa",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1185,
            "name": "Arica y Parinacota",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 1160,
            "name": "Lima",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 977,
            "name": "Burdur",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 694,
            "name": "\u0423\u0432\u0441",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 229,
            "name": "Niigata",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1398,
            "name": "Napo",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 262,
            "name": "Set\u00fabal",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 978,
            "name": "Bursa",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 242,
            "name": "Toyama",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 695,
            "name": "\u0425\u043e\u0432\u0434",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1399,
            "name": "Pastaza",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 263,
            "name": "Viana do Castelo",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 1186,
            "name": "del \u00d1uble",
            "country_id": [
                46,
                "Chile"
            ]
        },
        {
            "id": 1161,
            "name": "Loreto",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 1400,
            "name": "Pichincha",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 215,
            "name": "Ishikawa",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 264,
            "name": "Vila Real",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 696,
            "name": "\u0425\u04e9\u0432\u0441\u0433\u04e9\u043b",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1162,
            "name": "Madre de Dios",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 979,
            "name": "\u00c7anakkale",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 265,
            "name": "Viseu",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 1401,
            "name": "Tungurahua",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 1163,
            "name": "Moquegua",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 206,
            "name": "Fukui",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 980,
            "name": "\u00c7ank\u0131r\u0131",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 697,
            "name": "\u0425\u044d\u043d\u0442\u0438\u0439",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1164,
            "name": "Pasco",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 698,
            "name": "\u0414\u0430\u0440\u0445\u0430\u043d-\u0423\u0443\u043b",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 247,
            "name": "Yamanashi",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1402,
            "name": "Zamora Chinchipe",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 981,
            "name": "\u00c7orum",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1108,
            "name": "Alajuela",
            "country_id": [
                50,
                "Costa Rica"
            ]
        },
        {
            "id": 1165,
            "name": "Piura",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 699,
            "name": "\u041e\u0440\u0445\u043e\u043d",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 266,
            "name": "A\u00e7ores",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 982,
            "name": "Denizli",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 226,
            "name": "Nagano",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1403,
            "name": "Galapagos",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 209,
            "name": "Gifu",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1166,
            "name": "Puno",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 1404,
            "name": "Sucumbios",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 983,
            "name": "Diyarbak\u0131r",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1405,
            "name": "Orellana",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 238,
            "name": "Shizuoka",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 984,
            "name": "Edirne",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1167,
            "name": "San Mart\u00edn",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 201,
            "name": "Aichi",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1168,
            "name": "Tacna",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 700,
            "name": "\u0423\u0411 - \u0425\u0430\u043d \u0423\u0443\u043b",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1406,
            "name": "Santo Domingo de los Tsachilas",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 985,
            "name": "Elaz\u0131\u011f",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1169,
            "name": "Tumbes",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 986,
            "name": "Erzincan",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 223,
            "name": "Mie",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 701,
            "name": "\u0423\u0411 - \u0411\u0430\u044f\u043d\u0437\u04af\u0440\u0445",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1407,
            "name": "Santa Elena",
            "country_id": [
                63,
                "Ecuador"
            ]
        },
        {
            "id": 987,
            "name": "Erzurum",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 702,
            "name": "\u0423\u0411 - \u0421\u04af\u0445\u0431\u0430\u0430\u0442\u0430\u0440",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1170,
            "name": "Ucayali",
            "country_id": [
                173,
                "Peru"
            ]
        },
        {
            "id": 236,
            "name": "Shiga",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 703,
            "name": "\u0423\u0411 - \u0411\u0430\u044f\u043d\u0433\u043e\u043b",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 988,
            "name": "Eski\u015fehir",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 222,
            "name": "Kyoto",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 989,
            "name": "Gaziantep",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 233,
            "name": "Osaka",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 704,
            "name": "\u0423\u0411 - \u0411\u0430\u0433\u0430\u043d\u0443\u0443\u0440",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 705,
            "name": "\u0423\u0411 - \u0411\u0430\u0433\u0430\u0445\u0430\u043d\u0433\u0430\u0439",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 213,
            "name": "Hyogo",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 990,
            "name": "Giresun",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 228,
            "name": "Nara",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 991,
            "name": "G\u00fcm\u00fc\u015fhane",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 706,
            "name": "\u0423\u0411 - \u041d\u0430\u043b\u0430\u0439\u0445",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 1110,
            "name": "Cartago",
            "country_id": [
                50,
                "Costa Rica"
            ]
        },
        {
            "id": 267,
            "name": "Madeira",
            "country_id": [
                183,
                "Portugal"
            ]
        },
        {
            "id": 992,
            "name": "Hakkari",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 244,
            "name": "Wakayama",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 241,
            "name": "Tottori",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 993,
            "name": "Hatay",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 994,
            "name": "Isparta",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 707,
            "name": "\u0413\u043e\u0432\u044c\u0441\u04af\u043c\u0431\u044d\u0440",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 237,
            "name": "Shimane",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 231,
            "name": "Okayama",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 995,
            "name": "\u0130\u00e7el",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 211,
            "name": "Hiroshima",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 996,
            "name": "\u0130stanbul",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 708,
            "name": "\u0423\u0411 - \u0421\u043e\u043d\u0433\u0438\u043d\u043e \u0425\u0430\u0439\u0440\u0445\u0430\u043d",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 709,
            "name": "\u0423\u0411 - \u0427\u0438\u043d\u0433\u044d\u043b\u0442\u044d\u0439",
            "country_id": [
                146,
                "Mongolia"
            ]
        },
        {
            "id": 246,
            "name": "Yamaguchi",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 997,
            "name": "\u0130zmir",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 240,
            "name": "Tokushima",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 998,
            "name": "Kars",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 999,
            "name": "Kastamonu",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 217,
            "name": "Kagawa",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 205,
            "name": "Ehime",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1000,
            "name": "Kayseri",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 220,
            "name": "Kochi",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1001,
            "name": "K\u0131rklareli",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1109,
            "name": "Heredia",
            "country_id": [
                50,
                "Costa Rica"
            ]
        },
        {
            "id": 207,
            "name": "Fukuoka",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1002,
            "name": "K\u0131r\u015fehir",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1003,
            "name": "Kocaeli",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 234,
            "name": "Saga",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 227,
            "name": "Nagasaki",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1004,
            "name": "Konya",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1005,
            "name": "K\u00fctahya",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 221,
            "name": "Kumamoto",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1006,
            "name": "Malatya",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 230,
            "name": "Oita",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 225,
            "name": "Miyazaki",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1007,
            "name": "Manisa",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 218,
            "name": "Kagoshima",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1008,
            "name": "K.mara\u015f",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 232,
            "name": "Okinawa",
            "country_id": [
                113,
                "Japan"
            ]
        },
        {
            "id": 1009,
            "name": "Mardin",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1010,
            "name": "Mu\u011fla",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1011,
            "name": "Mu\u015f",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1112,
            "name": "Guanacaste",
            "country_id": [
                50,
                "Costa Rica"
            ]
        },
        {
            "id": 1012,
            "name": "Nev\u015fehir",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1013,
            "name": "Ni\u011fde",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1014,
            "name": "Ordu",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1015,
            "name": "Rize",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1016,
            "name": "Sakarya",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1017,
            "name": "Samsun",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1018,
            "name": "Siirt",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1019,
            "name": "Sinop",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1020,
            "name": "Sivas",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1021,
            "name": "Tekirda\u011f",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1111,
            "name": "Puntarenas",
            "country_id": [
                50,
                "Costa Rica"
            ]
        },
        {
            "id": 1022,
            "name": "Tokat",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1023,
            "name": "Trabzon",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1024,
            "name": "Tunceli",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1025,
            "name": "\u015eanl\u0131urfa",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1026,
            "name": "U\u015fak",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1027,
            "name": "Van",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1028,
            "name": "Yozgat",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1029,
            "name": "Zonguldak",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1030,
            "name": "Aksaray",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1031,
            "name": "Bayburt",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1113,
            "name": "Lim\u00f3n",
            "country_id": [
                50,
                "Costa Rica"
            ]
        },
        {
            "id": 1032,
            "name": "Karaman",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1033,
            "name": "K\u0131r\u0131kkale",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1034,
            "name": "Batman",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1035,
            "name": "\u015e\u0131rnak",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1036,
            "name": "Bart\u0131n",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1037,
            "name": "Ardahan",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1038,
            "name": "I\u011fd\u0131r",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1039,
            "name": "Yalova",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1040,
            "name": "Karab\u00fck",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1041,
            "name": "Kilis",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1042,
            "name": "Osmaniye",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 1043,
            "name": "D\u00fczce",
            "country_id": [
                224,
                "Turkey"
            ]
        },
        {
            "id": 420,
            "name": "Alacant (Alicante)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 569,
            "name": "Salta",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 710,
            "name": "Aberdeenshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 711,
            "name": "Angus",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 712,
            "name": "Argyll",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 713,
            "name": "Avon",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 68,
            "name": "Armed Forces Americas",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 905,
            "name": "Addis Ababa",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 829,
            "name": "Alba",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 419,
            "name": "Albacete",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 533,
            "name": "Alberta",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 613,
            "name": "Aceh",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 71,
            "name": "Acre",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 1,
            "name": "Australian Capital Territory",
            "country_id": [
                13,
                "Australia"
            ]
        },
        {
            "id": 98,
            "name": "Republic of Adygeya",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 69,
            "name": "Armed Forces Europe",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 906,
            "name": "Afar",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 306,
            "name": "Agrigento",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 830,
            "name": "Arge\u0219",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 485,
            "name": "Aguascalientes",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 943,
            "name": "Armagh",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 547,
            "name": "Ajman",
            "country_id": [
                2,
                "United Arab Emirates"
            ]
        },
        {
            "id": 10,
            "name": "Alaska",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 307,
            "name": "Alessandria",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 9,
            "name": "Alabama",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 99,
            "name": "Altai Republic",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 72,
            "name": "Alagoas",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 421,
            "name": "Almer\u00eda",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 100,
            "name": "Altai Krai",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 273,
            "name": "Alexandria",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 907,
            "name": "Amhara",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 942,
            "name": "Antrim",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 74,
            "name": "Amazonas",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 675,
            "name": "Amazonas",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 101,
            "name": "Amur Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 577,
            "name": "Andaman and Nicobar",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 308,
            "name": "Ancona",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 647,
            "name": "Antioquia",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 309,
            "name": "Aosta",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 73,
            "name": "Amap\u00e1",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 311,
            "name": "Ascoli Piceno",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 70,
            "name": "Armed Forces Pacific",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 578,
            "name": "Andhra Pradesh",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 350,
            "name": "L'Aquila",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 310,
            "name": "Arezzo",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 579,
            "name": "Arunachal Pradesh",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 12,
            "name": "Arkansas",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 831,
            "name": "Arad",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 671,
            "name": "Arauca",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 102,
            "name": "Arkhangelsk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 60,
            "name": "American Samoa",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 580,
            "name": "Assam",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 285,
            "name": "Aswan",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 103,
            "name": "Astrakhan Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 286,
            "name": "Asyut",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 312,
            "name": "Asti",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 648,
            "name": "Atl\u00e1ntico",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 517,
            "name": "Auckland",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 313,
            "name": "Avellino",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 423,
            "name": "\u00c1vila",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 179,
            "name": "Alta Verapaz",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 546,
            "name": "Abu Dhabi",
            "country_id": [
                2,
                "United Arab Emirates"
            ]
        },
        {
            "id": 11,
            "name": "Arizona",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 1115,
            "name": "Azua",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 832,
            "name": "Bucure\u0219ti",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 554,
            "name": "Buenos Aires",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 426,
            "name": "Barcelona",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 714,
            "name": "Ayrshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 715,
            "name": "Banffshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 716,
            "name": "Bedfordshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 717,
            "name": "Berkshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 718,
            "name": "Berwickshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 104,
            "name": "Republic of Bashkortostan",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 314,
            "name": "Bari",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 269,
            "name": "Red Sea",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 424,
            "name": "Badajoz",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 614,
            "name": "Bali",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 75,
            "name": "Bahia",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 1116,
            "name": "Bahoruco",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 1117,
            "name": "Barahona",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 615,
            "name": "Bangka Belitung",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 534,
            "name": "British Columbia",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 833,
            "name": "Bac\u0103u",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 486,
            "name": "Baja California",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 487,
            "name": "Baja California Sur",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 617,
            "name": "Bengkulu",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 105,
            "name": "Belgorod Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 318,
            "name": "Bergamo",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 834,
            "name": "Bihor",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 270,
            "name": "Beheira",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 466,
            "name": "Bizkaia (Vizcaya)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 319,
            "name": "Biella",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 316,
            "name": "Belluno",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 317,
            "name": "Benevento",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 835,
            "name": "Bistri\u021ba-N\u0103s\u0103ud",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 908,
            "name": "Benishangul-Gumuz",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 287,
            "name": "Beni Suef",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 320,
            "name": "Bologna",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 650,
            "name": "Bol\u00edvar",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 518,
            "name": "Bay of Plenty",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 651,
            "name": "Boyac\u00e1",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 960,
            "name": "Bonaire",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 961,
            "name": "Saba",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 962,
            "name": "Sint Eustatius",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 581,
            "name": "Bihar",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 323,
            "name": "Brindisi",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 836,
            "name": "Br\u0103ila",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 106,
            "name": "Bryansk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 322,
            "name": "Brescia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 837,
            "name": "Boto\u0219ani",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 315,
            "name": "Barletta-Andria-Trani",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 616,
            "name": "Banten",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 427,
            "name": "Burgos",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 107,
            "name": "Republic of Buryatia",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 838,
            "name": "Bra\u0219ov",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 180,
            "name": "Baja Verapaz",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 321,
            "name": "Bolzano",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 839,
            "name": "Buz\u0103u",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 553,
            "name": "Ciudad Aut\u00f3noma de Buenos Aires",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 417,
            "name": "A Coru\u00f1a (La Coru\u00f1a)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 919,
            "name": "Cork",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 278,
            "name": "Cairo",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 719,
            "name": "Buckinghamshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 720,
            "name": "Caithness",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 721,
            "name": "Cambridgeshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 722,
            "name": "Channel Islands",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 723,
            "name": "Cheshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 724,
            "name": "Clackmannanshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 324,
            "name": "Cagliari",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 13,
            "name": "California",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 429,
            "name": "C\u00e1diz",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 652,
            "name": "Caldas",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 490,
            "name": "Campeche",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 519,
            "name": "Canterbury",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 653,
            "name": "Caquet\u00e1",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 672,
            "name": "Casanare",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 654,
            "name": "Cauca",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 326,
            "name": "Campobasso",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 428,
            "name": "C\u00e1ceres",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 328,
            "name": "Caserta",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 918,
            "name": "Clare",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 432,
            "name": "Ceuta",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 76,
            "name": "Cear\u00e1",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 108,
            "name": "Chechen Republic",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 655,
            "name": "Cesar",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 583,
            "name": "Chattisgarh",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 331,
            "name": "Chieti",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 582,
            "name": "Chandigarh",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 109,
            "name": "Chelyabinsk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 488,
            "name": "Chihuahua",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 658,
            "name": "Choc\u00f3",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 492,
            "name": "Chiapas",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 110,
            "name": "Chukotka Autonomous Okrug",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 327,
            "name": "Carbonia-Iglesias",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 840,
            "name": "Cluj",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 325,
            "name": "Caltanissetta",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 841,
            "name": "C\u0103l\u0103ra\u0219i",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 181,
            "name": "Chimaltenango",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 493,
            "name": "Ciudad de M\u00e9xico",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 917,
            "name": "Cavan",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 336,
            "name": "Cuneo",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 332,
            "name": "Como",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 14,
            "name": "Colorado",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 434,
            "name": "C\u00f3rdoba",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 491,
            "name": "Coahuila",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 489,
            "name": "Colima",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 656,
            "name": "C\u00f3rdoba",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 182,
            "name": "Chiquimula",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 433,
            "name": "Ciudad Real",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 334,
            "name": "Cremona",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 842,
            "name": "Cara\u0219 Severin",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 333,
            "name": "Cosenza",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 431,
            "name": "Castell\u00f3 (Castell\u00f3n)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 15,
            "name": "Connecticut",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 843,
            "name": "Constan\u021ba",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 329,
            "name": "Catania",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 111,
            "name": "Chuvash Republic",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 435,
            "name": "Cuenca",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 657,
            "name": "Cundinamarca",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 844,
            "name": "Covasna",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 916,
            "name": "Carlow",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 330,
            "name": "Catanzaro",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 923,
            "name": "Dublin",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 571,
            "name": "San Luis",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 725,
            "name": "Cleveland",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 726,
            "name": "Clwyd",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 727,
            "name": "County Antrim",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 728,
            "name": "County Armagh",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 729,
            "name": "County Down",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 112,
            "name": "Republic of Dagestan",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 1118,
            "name": "Dajab\u00f3n",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 845,
            "name": "D\u00e2mbovi\u021ba",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 649,
            "name": "Bogot\u00e1",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 17,
            "name": "District of Columbia",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 585,
            "name": "Daman and Diu",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 16,
            "name": "Delaware",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 77,
            "name": "Distrito Federal",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 846,
            "name": "Dolj",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 268,
            "name": "Dakahlia",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 586,
            "name": "Delhi",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 922,
            "name": "Donegal",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 944,
            "name": "Down",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 584,
            "name": "Dadra and Nagar Haveli",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 1114,
            "name": "Distrito Nacional",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 948,
            "name": "Drenthe",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 909,
            "name": "Dire Dawa",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 289,
            "name": "Damietta",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 548,
            "name": "Dubai",
            "country_id": [
                2,
                "United Arab Emirates"
            ]
        },
        {
            "id": 1119,
            "name": "Duarte",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 494,
            "name": "Durango",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 560,
            "name": "Entre R\u00edos",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 730,
            "name": "County Durham",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 731,
            "name": "County Fermanagh",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 732,
            "name": "County Londonderry",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 733,
            "name": "County Tyrone",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 734,
            "name": "Cornwall",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 297,
            "name": "Eastern Cape",
            "country_id": [
                247,
                "South Africa"
            ]
        },
        {
            "id": 1187,
            "name": "Harjumaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1188,
            "name": "Hiiumaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1189,
            "name": "Ida-Virumaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1190,
            "name": "J\u00f5gevamaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1191,
            "name": "J\u00e4rvamaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1192,
            "name": "L\u00e4\u00e4nemaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1193,
            "name": "L\u00e4\u00e4ne-Virumaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1194,
            "name": "P\u00f5lvamaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1195,
            "name": "P\u00e4rnumaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1196,
            "name": "Raplamaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1197,
            "name": "Saaremaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1198,
            "name": "Tartumaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1199,
            "name": "Valgamaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1200,
            "name": "Viljandimaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1201,
            "name": "V\u00f5rumaa",
            "country_id": [
                64,
                "Estonia"
            ]
        },
        {
            "id": 1120,
            "name": "El\u00edas Pi\u00f1a",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 1121,
            "name": "El Seibo",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 337,
            "name": "Enna",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 183,
            "name": "El Progreso",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 78,
            "name": "Esp\u00edrito Santo",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 184,
            "name": "Escuintla",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 1122,
            "name": "Espaillat",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 564,
            "name": "La Rioja",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 735,
            "name": "Cumbria",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 736,
            "name": "Derbyshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 737,
            "name": "Devon",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 738,
            "name": "Dorset",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 739,
            "name": "Dumfriesshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 342,
            "name": "Forl\u00ec-Cesena",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 339,
            "name": "Ferrara",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 341,
            "name": "Foggia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 945,
            "name": "Fermanagh",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 340,
            "name": "Firenze",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 1331,
            "name": "Ahvenanmaa",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1332,
            "name": "Etel\u00e4-Karjala",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1333,
            "name": "Etel\u00e4-Pohjanmaa",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1334,
            "name": "Etel\u00e4-Savo",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1335,
            "name": "Kainuu",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1336,
            "name": "Kanta-H\u00e4me",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1337,
            "name": "Keski-Pohjanmaa",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1338,
            "name": "Keski-Suomi",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1339,
            "name": "Kymenlaakso",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1340,
            "name": "Lappi",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1341,
            "name": "Pirkanmaa",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1342,
            "name": "Pohjanmaa",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1343,
            "name": "Pohjois-Karjala",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1344,
            "name": "Pohjois-Pohjanmaa",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1345,
            "name": "Pohjois-Savo",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1346,
            "name": "P\u00e4ij\u00e4t-H\u00e4me",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1347,
            "name": "Satakunta",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1348,
            "name": "Uusimaa",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 1349,
            "name": "Varsinais-Suomi",
            "country_id": [
                70,
                "Finland"
            ]
        },
        {
            "id": 949,
            "name": "Flevoland",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 18,
            "name": "Florida",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 338,
            "name": "Fermo",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 61,
            "name": "Federated States of Micronesia",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 343,
            "name": "Frosinone",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 950,
            "name": "Friesland",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 298,
            "name": "Free State",
            "country_id": [
                247,
                "South Africa"
            ]
        },
        {
            "id": 549,
            "name": "Fujairah",
            "country_id": [
                2,
                "United Arab Emirates"
            ]
        },
        {
            "id": 271,
            "name": "Faiyum",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 924,
            "name": "Galway",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 574,
            "name": "Santiago Del Estero",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 740,
            "name": "Dunbartonshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 741,
            "name": "Dyfed",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 742,
            "name": "East Lothian",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 743,
            "name": "East Sussex",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 744,
            "name": "Essex",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 587,
            "name": "Goa",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 19,
            "name": "Georgia",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 444,
            "name": "Las Palmas",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 344,
            "name": "Genova",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 951,
            "name": "Gelderland",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 272,
            "name": "Gharbia",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 436,
            "name": "Girona (Gerona)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 520,
            "name": "Gisborne",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 588,
            "name": "Gujarat",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 847,
            "name": "Gorj",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 848,
            "name": "Gala\u021bi",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 910,
            "name": "Gambella Peoples",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 618,
            "name": "Gorontalo",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 345,
            "name": "Gorizia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 79,
            "name": "Goi\u00e1s",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 437,
            "name": "Granada",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 346,
            "name": "Grosseto",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 952,
            "name": "Groningen",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 849,
            "name": "Giurgiu",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 495,
            "name": "Guerrero",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 299,
            "name": "Gauteng",
            "country_id": [
                247,
                "South Africa"
            ]
        },
        {
            "id": 438,
            "name": "Guadalajara",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 62,
            "name": "Guam",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 676,
            "name": "Guain\u00eda",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 496,
            "name": "Guanajuato",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 185,
            "name": "Guatemala",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 677,
            "name": "Guaviare",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 275,
            "name": "Giza",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 440,
            "name": "Huelva",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 556,
            "name": "Chaco",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 745,
            "name": "Fife",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 746,
            "name": "Gloucestershire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 747,
            "name": "Gwent",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 748,
            "name": "Gwynedd",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 1143,
            "name": "Hato Mayor",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 850,
            "name": "Hunedoara",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 1132,
            "name": "Hermanas Mirabal",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 20,
            "name": "Hawaii",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 497,
            "name": "Hidalgo",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 521,
            "name": "Hawke's Bay",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 590,
            "name": "Himachal Pradesh",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 911,
            "name": "Harrari Peoples",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 851,
            "name": "Harghita",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 589,
            "name": "Haryana",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 290,
            "name": "Helwan",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 441,
            "name": "Huesca",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 186,
            "name": "Huehuetenango",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 659,
            "name": "Huila",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 749,
            "name": "Hampshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 750,
            "name": "Herefordshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 751,
            "name": "Hertfordshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 752,
            "name": "Inverness-Shire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 753,
            "name": "Isle of Arran",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 24,
            "name": "Iowa",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 21,
            "name": "Idaho",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 852,
            "name": "Ilfov",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 853,
            "name": "Ialomi\u021ba",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 22,
            "name": "Illinois",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 347,
            "name": "Imperia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 23,
            "name": "Indiana",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 113,
            "name": "Republic of Ingushetia",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 1123,
            "name": "Independencia",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 114,
            "name": "Irkutsk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 274,
            "name": "Ismailia",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 854,
            "name": "Ia\u0219i",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 348,
            "name": "Isernia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 115,
            "name": "Ivanovo Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 187,
            "name": "Izabal",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 442,
            "name": "Ja\u00e9n",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 570,
            "name": "San Juan",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 754,
            "name": "Isle of Barra",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 755,
            "name": "Isle of Benbecula",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 756,
            "name": "Isle of Bute",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 757,
            "name": "Isle of Canna",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 758,
            "name": "Isle of Coll",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 620,
            "name": "Jambi",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 188,
            "name": "Jalapa",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 498,
            "name": "Jalisco",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 621,
            "name": "Jawa Barat",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 592,
            "name": "Jharkhand",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 469,
            "name": "Johor",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 623,
            "name": "Jawa Timur",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 619,
            "name": "Jakarta",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 591,
            "name": "Jammu and Kashmir",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 291,
            "name": "South Sinai",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 622,
            "name": "Jawa Tengah",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 189,
            "name": "Jutiapa",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 555,
            "name": "Catamarca",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 759,
            "name": "Isle of Colonsay",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 760,
            "name": "Isle of Cumbrae",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 761,
            "name": "Isle of Eigg",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 762,
            "name": "Isle of Gigha",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 763,
            "name": "Isle of Harris",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 593,
            "name": "Karnataka",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 116,
            "name": "Kamchatka Krai",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 117,
            "name": "Kabardino-Balkarian Republic",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 279,
            "name": "Qalyubia",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 624,
            "name": "Kalimantan Barat",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 121,
            "name": "Karachay\u2013Cherkess Republic",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 130,
            "name": "Krasnodar Krai",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 470,
            "name": "Kedah",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 926,
            "name": "Kildare",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 123,
            "name": "Kemerovo Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 292,
            "name": "Kafr el-Sheikh",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 118,
            "name": "Kaliningrad Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 132,
            "name": "Kurgan Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 124,
            "name": "Khabarovsk Krai",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 126,
            "name": "Khanty-Mansi Autonomous Okrug",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 627,
            "name": "Kalimantan Timur",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 127,
            "name": "Kirov Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 125,
            "name": "Republic of Khakassia",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 927,
            "name": "Kilkenny",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 594,
            "name": "Kerala",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 119,
            "name": "Republic of Kalmykia",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 120,
            "name": "Kaluga Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 294,
            "name": "Qena",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 128,
            "name": "Komi Republic",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 129,
            "name": "Kostroma Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 335,
            "name": "Crotone",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 122,
            "name": "Republic of Karelia",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 629,
            "name": "Kepulauan Riau",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 133,
            "name": "Kursk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 625,
            "name": "Kalimantan Selatan",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 25,
            "name": "Kansas",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 626,
            "name": "Kalimantan Tengah",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 471,
            "name": "Kelantan",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 628,
            "name": "Kalimantan Utara",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 472,
            "name": "Kuala Lumpur",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 925,
            "name": "Kerry",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 26,
            "name": "Kentucky",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 131,
            "name": "Krasnoyarsk Krai",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 446,
            "name": "Lleida (L\u00e9rida)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 563,
            "name": "La Pampa",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 764,
            "name": "Isle of Iona",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 765,
            "name": "Isle of Islay",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 766,
            "name": "Isle of Jura",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 767,
            "name": "Isle of Lewis",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 768,
            "name": "Isle of Man",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 27,
            "name": "Louisiana",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 630,
            "name": "Lampung",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 1124,
            "name": "La Altagracia",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 660,
            "name": "La Guajira",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 473,
            "name": "Labuan",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 353,
            "name": "Lecco",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 930,
            "name": "Longford",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 595,
            "name": "Lakshadweep",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 352,
            "name": "Lecce",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 445,
            "name": "Le\u00f3n",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 134,
            "name": "Leningrad Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 931,
            "name": "Louth",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 953,
            "name": "Limburg",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 354,
            "name": "Livorno",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 135,
            "name": "Lipetsk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 920,
            "name": "Limerick",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 929,
            "name": "Leitrim",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 443,
            "name": "La Rioja",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 355,
            "name": "Lodi",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 301,
            "name": "Limpopo",
            "country_id": [
                247,
                "South Africa"
            ]
        },
        {
            "id": 1125,
            "name": "La Romana",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 928,
            "name": "Laois",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 351,
            "name": "Latina",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 1321,
            "name": "Alytaus apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 1323,
            "name": "Klaip\u0117dos apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 1322,
            "name": "Kauno apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 1324,
            "name": "Marijampol\u0117s apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 1325,
            "name": "Panev\u0117\u017eio apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 1326,
            "name": "\u0160iauli\u0173 apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 1327,
            "name": "Taurag\u0117s apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 1328,
            "name": "Tel\u0161i\u0173 apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 1329,
            "name": "Utenos apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 1330,
            "name": "Vilniaus apskritis",
            "country_id": [
                132,
                "Lithuania"
            ]
        },
        {
            "id": 447,
            "name": "Lugo",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 356,
            "name": "Lucca",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 1126,
            "name": "La Vega",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 1202,
            "name": "Aglonas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1203,
            "name": "Aizkraukles novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1204,
            "name": "Aizputes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1205,
            "name": "Akn\u012bstes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1206,
            "name": "Alojas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1207,
            "name": "Alsungas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1208,
            "name": "Al\u016bksnes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1209,
            "name": "Amatas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1210,
            "name": "Apes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1211,
            "name": "Auces novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1212,
            "name": "\u0100da\u017eu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1213,
            "name": "Bab\u012btes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1214,
            "name": "Baldones novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1215,
            "name": "Baltinavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1216,
            "name": "Balvu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1217,
            "name": "Bauskas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1218,
            "name": "Bever\u012bnas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1219,
            "name": "Broc\u0113nu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1220,
            "name": "Burtnieku novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1221,
            "name": "Carnikavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1222,
            "name": "Cesvaines novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1223,
            "name": "C\u0113su novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1224,
            "name": "Ciblas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1225,
            "name": "Dagdas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1226,
            "name": "Daugavpils novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1227,
            "name": "Dobeles novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1228,
            "name": "Dundagas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1229,
            "name": "Durbes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1230,
            "name": "Engures novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1231,
            "name": "\u0112rg\u013cu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1232,
            "name": "Garkalnes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1233,
            "name": "Grobi\u0146as novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1234,
            "name": "Gulbenes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1235,
            "name": "Iecavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1236,
            "name": "Ik\u0161\u0137iles novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1237,
            "name": "Il\u016bkstes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1238,
            "name": "In\u010dukalna novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1239,
            "name": "Jaunjelgavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1240,
            "name": "Jaunpiebalgas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1241,
            "name": "Jaunpils novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1242,
            "name": "Jelgavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1243,
            "name": "J\u0113kabpils novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1244,
            "name": "Kandavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1245,
            "name": "K\u0101rsavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1246,
            "name": "Koc\u0113nu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1247,
            "name": "Kokneses novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1248,
            "name": "Kr\u0101slavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1249,
            "name": "Krimuldas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1250,
            "name": "Krustpils novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1251,
            "name": "Kuld\u012bgas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1252,
            "name": "\u0136eguma novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1253,
            "name": "\u0136ekavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1254,
            "name": "Lielv\u0101rdes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1255,
            "name": "Limba\u017eu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1256,
            "name": "L\u012bgatnes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1257,
            "name": "L\u012bv\u0101nu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1258,
            "name": "Lub\u0101nas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1259,
            "name": "Ludzas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1260,
            "name": "Madonas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1261,
            "name": "Mazsalacas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1262,
            "name": "M\u0101lpils novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1263,
            "name": "M\u0101rupes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1264,
            "name": "M\u0113rsraga novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1265,
            "name": "Nauk\u0161\u0113nu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1266,
            "name": "Neretas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1267,
            "name": "N\u012bcas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1268,
            "name": "Ogres novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1269,
            "name": "Olaines novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1270,
            "name": "Ozolnieku novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1271,
            "name": "P\u0101rgaujas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1272,
            "name": "P\u0101vilostas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1273,
            "name": "P\u013cavi\u0146u novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1274,
            "name": "Prei\u013cu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1275,
            "name": "Priekules novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1276,
            "name": "Prieku\u013cu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1277,
            "name": "Raunas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1278,
            "name": "R\u0113zeknes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1279,
            "name": "Riebi\u0146u novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1280,
            "name": "Rojas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1281,
            "name": "Ropa\u017eu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1282,
            "name": "Rucavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1283,
            "name": "Rug\u0101ju novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1284,
            "name": "Rund\u0101les novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1285,
            "name": "R\u016bjienas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1286,
            "name": "Salas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1287,
            "name": "Salacgr\u012bvas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1288,
            "name": "Salaspils novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1289,
            "name": "Saldus novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1290,
            "name": "Saulkrastu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1291,
            "name": "S\u0113jas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1292,
            "name": "Siguldas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1293,
            "name": "Skr\u012bveru novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1294,
            "name": "Skrundas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1295,
            "name": "Smiltenes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1296,
            "name": "Stopi\u0146u novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1297,
            "name": "Stren\u010du novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1298,
            "name": "Talsu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1299,
            "name": "T\u0113rvetes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1300,
            "name": "Tukuma novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1301,
            "name": "Vai\u0146odes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1302,
            "name": "Valkas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1303,
            "name": "Varak\u013c\u0101nu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1304,
            "name": "V\u0101rkavas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1305,
            "name": "Vecpiebalgas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1306,
            "name": "Vecumnieku novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1307,
            "name": "Ventspils novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1308,
            "name": "Vies\u012btes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1309,
            "name": "Vi\u013cakas novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1310,
            "name": "Vi\u013c\u0101nu novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1311,
            "name": "Zilupes novads",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1312,
            "name": "Daugavpils",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1313,
            "name": "Jelgava",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1314,
            "name": "J\u0113kabpils",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1315,
            "name": "J\u016brmala",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1316,
            "name": "Liep\u0101ja",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1317,
            "name": "R\u0113zekne",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1318,
            "name": "R\u012bga",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1320,
            "name": "Ventspils",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 1319,
            "name": "Valmiera",
            "country_id": [
                134,
                "Latvia"
            ]
        },
        {
            "id": 280,
            "name": "Luxor",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 946,
            "name": "Londonderry",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 448,
            "name": "Madrid",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 565,
            "name": "Mendoza",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 769,
            "name": "Isle of Mull",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 770,
            "name": "Isle of North Uist",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 823,
            "name": "Orkney",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 771,
            "name": "Isle of Rhum",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 772,
            "name": "Isle of Scalpay",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 80,
            "name": "Maranh\u00e3o",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 449,
            "name": "M\u00e1laga",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 42,
            "name": "Massachusetts",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 631,
            "name": "Maluku",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 136,
            "name": "Magadan Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 661,
            "name": "Magdalena",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 365,
            "name": "Monza e Brianza",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 535,
            "name": "Manitoba",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 523,
            "name": "Marlborough",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 1128,
            "name": "Monte Cristi",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 357,
            "name": "Macerata",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 41,
            "name": "Maryland",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 450,
            "name": "Melilla",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 28,
            "name": "Maine",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 362,
            "name": "Messina",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 137,
            "name": "Mari El Republic",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 662,
            "name": "Meta",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 501,
            "name": "M\u00e9xico",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 83,
            "name": "Minas Gerais",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 597,
            "name": "Maharashtra",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 63,
            "name": "Marshall Islands",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 855,
            "name": "Mehedin\u021bi",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 933,
            "name": "Meath",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 363,
            "name": "Milano",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 43,
            "name": "Michigan",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 499,
            "name": "Michoac\u00e1n",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 599,
            "name": "Meghalaya",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 474,
            "name": "Melaka",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 856,
            "name": "Maramure\u0219",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 934,
            "name": "Monaghan",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 598,
            "name": "Manipur",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 44,
            "name": "Minnesota",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 277,
            "name": "Minya",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 358,
            "name": "Mantova",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 276,
            "name": "Monufia",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 138,
            "name": "Republic of Mordovia",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 932,
            "name": "Mayo",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 46,
            "name": "Missouri",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 364,
            "name": "Modena",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 1141,
            "name": "Monse\u00f1or Nouel",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 500,
            "name": "Morelos",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 139,
            "name": "Moscow Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 140,
            "name": "Moscow",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 302,
            "name": "Mpumalanga",
            "country_id": [
                247,
                "South Africa"
            ]
        },
        {
            "id": 596,
            "name": "Madhya Pradesh",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 1142,
            "name": "Monte Plata",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 64,
            "name": "Northern Mariana Islands",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 359,
            "name": "Massa-Carrara",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 82,
            "name": "Mato Grosso do Sul",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 45,
            "name": "Mississippi",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 857,
            "name": "Mure\u0219",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 81,
            "name": "Mato Grosso",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 29,
            "name": "Montana",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 360,
            "name": "Matera",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 293,
            "name": "Matrouh",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 1127,
            "name": "Mar\u00eda Trinidad S\u00e1nchez",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 451,
            "name": "Murcia",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 632,
            "name": "Maluku Utara",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 141,
            "name": "Murmansk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 522,
            "name": "Manawatu-Wanganui",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 600,
            "name": "Mizoram",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 566,
            "name": "Misiones",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 773,
            "name": "Shetland Islands",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 774,
            "name": "Isle of Skye",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 775,
            "name": "Isle of South Uist",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 776,
            "name": "Isle of Tiree",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 777,
            "name": "Isle of Wight",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 366,
            "name": "Napoli",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 452,
            "name": "Navarra (Nafarroa)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 663,
            "name": "Nari\u00f1o",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 502,
            "name": "Nayarit",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 633,
            "name": "Nusa Tenggara Barat",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 536,
            "name": "New Brunswick",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 954,
            "name": "Noord-Brabant",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 303,
            "name": "Northern Cape",
            "country_id": [
                247,
                "South Africa"
            ]
        },
        {
            "id": 36,
            "name": "North Carolina",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 37,
            "name": "North Dakota",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 30,
            "name": "Nebraska",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 143,
            "name": "Novgorod Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 955,
            "name": "Noord-Holland",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 32,
            "name": "New Hampshire",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 142,
            "name": "Nizhny Novgorod Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 33,
            "name": "New Jersey",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 537,
            "name": "Newfoundland and Labrador",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 300,
            "name": "KwaZulu-Natal",
            "country_id": [
                247,
                "South Africa"
            ]
        },
        {
            "id": 601,
            "name": "Nagaland",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 503,
            "name": "Nuevo Le\u00f3n",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 34,
            "name": "New Mexico",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 367,
            "name": "Novara",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 1375,
            "name": "Oslo",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1376,
            "name": "Rogaland",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1373,
            "name": "M\u00f8re og Romsdal",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1374,
            "name": "Nordland",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1383,
            "name": "Svalbard",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1382,
            "name": "Jan Mayen",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1381,
            "name": "Viken",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1372,
            "name": "Innlandet",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1379,
            "name": "Vestfold og Telemark",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1371,
            "name": "Agder",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1380,
            "name": "Vestland",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1378,
            "name": "Tr\u00f8ndelag",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 1377,
            "name": "Troms og Finnmark / Romsa ja Finnm\u00e1rku",
            "country_id": [
                166,
                "Norway"
            ]
        },
        {
            "id": 539,
            "name": "Nova Scotia",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 664,
            "name": "Norte de Santander",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 475,
            "name": "Negeri Sembilan",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 524,
            "name": "Nelson",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 2,
            "name": "New South Wales",
            "country_id": [
                13,
                "Australia"
            ]
        },
        {
            "id": 858,
            "name": "Neam\u021b",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 634,
            "name": "Nusa Tenggara Timur",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 538,
            "name": "Northwest Territories",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 3,
            "name": "Northern Territory",
            "country_id": [
                13,
                "Australia"
            ]
        },
        {
            "id": 525,
            "name": "Northland",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 368,
            "name": "Nuoro",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 540,
            "name": "Nunavut",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 31,
            "name": "Nevada",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 144,
            "name": "Novosibirsk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 304,
            "name": "North West",
            "country_id": [
                247,
                "South Africa"
            ]
        },
        {
            "id": 35,
            "name": "New York",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 422,
            "name": "Asturias",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 824,
            "name": "Isles of Scilly",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 778,
            "name": "Kent",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 779,
            "name": "Kincardineshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 780,
            "name": "Kinross-Shire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 504,
            "name": "Oaxaca",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 369,
            "name": "Ogliastra",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 38,
            "name": "Ohio",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 39,
            "name": "Oklahoma",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 145,
            "name": "Omsk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 541,
            "name": "Ontario",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 912,
            "name": "Oromia",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 602,
            "name": "Orissa",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 371,
            "name": "Oristano",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 453,
            "name": "Ourense (Orense)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 40,
            "name": "Oregon",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 146,
            "name": "Orenburg Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 147,
            "name": "Oryol Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 370,
            "name": "Olbia-Tempio",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 859,
            "name": "Olt",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 526,
            "name": "Otago",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 956,
            "name": "Overijssel",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 935,
            "name": "Offaly",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 561,
            "name": "Formosa",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 454,
            "name": "Palencia",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 781,
            "name": "Kirkcudbrightshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 825,
            "name": "Lanarkshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 782,
            "name": "Lancashire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 783,
            "name": "Leicestershire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 784,
            "name": "Lincolnshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 47,
            "name": "Pennsylvania",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 84,
            "name": "Par\u00e1",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 635,
            "name": "Papua",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 373,
            "name": "Palermo",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 636,
            "name": "Papua Barat",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 85,
            "name": "Para\u00edba",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 604,
            "name": "Punjab",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 379,
            "name": "Piacenza",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 372,
            "name": "Padova",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 87,
            "name": "Pernambuco",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 378,
            "name": "Pescara",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 542,
            "name": "Prince Edward Island",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 1129,
            "name": "Pedernales",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 1130,
            "name": "Peravia",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 149,
            "name": "Perm Krai",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 190,
            "name": "Pet\u00e9n",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 376,
            "name": "Perugia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 860,
            "name": "Prahova",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 476,
            "name": "Pahang",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 88,
            "name": "Piau\u00ed",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 380,
            "name": "Pisa",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 480,
            "name": "Putrajaya",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 478,
            "name": "Perlis",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 425,
            "name": "Illes Balears (Islas Baleares)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 382,
            "name": "Pordenone",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 479,
            "name": "Pulau Pinang",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 148,
            "name": "Penza Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 455,
            "name": "Pontevedra",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 384,
            "name": "Prato",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 1131,
            "name": "Puerto Plata",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 374,
            "name": "Parma",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 86,
            "name": "Paran\u00e1",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 66,
            "name": "Puerto Rico",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 150,
            "name": "Primorsky Krai",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 477,
            "name": "Perak",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 151,
            "name": "Pskov Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 381,
            "name": "Pistoia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 288,
            "name": "Port Said",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 377,
            "name": "Pesaro e Urbino",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 505,
            "name": "Puebla",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 673,
            "name": "Putumayo",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 375,
            "name": "Pavia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 65,
            "name": "Palau",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 603,
            "name": "Puducherry",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 383,
            "name": "Potenza",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 567,
            "name": "Neuqu\u00e9n",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 826,
            "name": "London",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 785,
            "name": "Merseyside",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 786,
            "name": "Mid Glamorgan",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 827,
            "name": "Midlothian",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 787,
            "name": "Middlesex",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 543,
            "name": "Quebec",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 4,
            "name": "Queensland",
            "country_id": [
                13,
                "Australia"
            ]
        },
        {
            "id": 191,
            "name": "Quetzaltenango",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 507,
            "name": "Quer\u00e9taro",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 665,
            "name": "Quind\u00edo",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 192,
            "name": "Quich\u00e9",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 568,
            "name": "R\u00edo Negro",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 788,
            "name": "Morayshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 789,
            "name": "Nairnshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 828,
            "name": "Norfolk",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 790,
            "name": "North Humberside",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 791,
            "name": "North Yorkshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 386,
            "name": "Ravenna",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 387,
            "name": "Reggio Calabria",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 388,
            "name": "Reggio Emilia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 193,
            "name": "Retalhuleu",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 385,
            "name": "Ragusa",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 48,
            "name": "Rhode Island",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 389,
            "name": "Rieti",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 637,
            "name": "Riau",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 666,
            "name": "Risaralda",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 89,
            "name": "Rio de Janeiro",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 605,
            "name": "Rajasthan",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 550,
            "name": "Ras al-Khaimah",
            "country_id": [
                2,
                "United Arab Emirates"
            ]
        },
        {
            "id": 391,
            "name": "Roma",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 390,
            "name": "Rimini",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 936,
            "name": "Roscommon",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 90,
            "name": "Rio Grande do Norte",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 92,
            "name": "Rond\u00f4nia",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 392,
            "name": "Rovigo",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 506,
            "name": "Quintana Roo",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 152,
            "name": "Rostov Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 93,
            "name": "Roraima",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 91,
            "name": "Rio Grande do Sul",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 153,
            "name": "Ryazan Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 573,
            "name": "Santa Fe",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 430,
            "name": "Cantabria",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 792,
            "name": "Northamptonshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 793,
            "name": "Northumberland",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 794,
            "name": "Nottinghamshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 795,
            "name": "Oxfordshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 796,
            "name": "Peeblesshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 456,
            "name": "Salamanca",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 5,
            "name": "South Australia",
            "country_id": [
                13,
                "Australia"
            ]
        },
        {
            "id": 393,
            "name": "Salerno",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 154,
            "name": "Sakha Republic (Yakutia)",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 642,
            "name": "Sulawesi Utara",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 194,
            "name": "Sacatep\u00e9quez",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 155,
            "name": "Sakhalin Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 1133,
            "name": "Saman\u00e1",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 156,
            "name": "Samara Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 667,
            "name": "Santander",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 674,
            "name": "San Andr\u00e9s y Providencia",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 158,
            "name": "Saratov Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 643,
            "name": "Sumatra Barat",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 861,
            "name": "Sibiu",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 481,
            "name": "Sabah",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 49,
            "name": "South Carolina",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 1134,
            "name": "San Crist\u00f3bal",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 94,
            "name": "Santa Catarina",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 50,
            "name": "South Dakota",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 1145,
            "name": "Santo Domingo",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 459,
            "name": "Sevilla",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 96,
            "name": "Sergipe",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 159,
            "name": "Republic of North Ossetia\u2013Alania",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 1361,
            "name": "Stockholms l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1365,
            "name": "V\u00e4sterbottens l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1359,
            "name": "Norrbottens l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1363,
            "name": "Uppsala l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1362,
            "name": "S\u00f6dermanlands l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1370,
            "name": "\u00d6sterg\u00f6tlands l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1356,
            "name": "J\u00f6nk\u00f6pings l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1358,
            "name": "Kronobergs l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1357,
            "name": "Kalmar l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1352,
            "name": "Gotlands l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1350,
            "name": "Blekinge l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1360,
            "name": "Sk\u00e5ne l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1354,
            "name": "Hallands l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1368,
            "name": "V\u00e4stra G\u00f6talands l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1364,
            "name": "V\u00e4rmlands l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1369,
            "name": "\u00d6rebro l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1367,
            "name": "V\u00e4stmanlands l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1351,
            "name": "Dalarnas l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1353,
            "name": "G\u00e4vleborgs l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1366,
            "name": "V\u00e4sternorrlands l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 1355,
            "name": "J\u00e4mtlands l\u00e4n",
            "country_id": [
                196,
                "Sweden"
            ]
        },
        {
            "id": 458,
            "name": "Segovia",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 641,
            "name": "Sulawesi Tenggara",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 483,
            "name": "Selangor",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 551,
            "name": "Sharjah",
            "country_id": [
                2,
                "United Arab Emirates"
            ]
        },
        {
            "id": 296,
            "name": "Sohag",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 282,
            "name": "Al Sharqia",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 396,
            "name": "Siena",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 295,
            "name": "North Sinai",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 508,
            "name": "Sinaloa",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 1135,
            "name": "San Juan",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 862,
            "name": "S\u0103laj",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 1144,
            "name": "San Jos\u00e9 de Ocoa",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 544,
            "name": "Saskatchewan",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 606,
            "name": "Sikkim",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 509,
            "name": "San Luis Potos\u00ed",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 863,
            "name": "Satu Mare",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 913,
            "name": "Somalia",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 195,
            "name": "San Marcos",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 160,
            "name": "Smolensk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 639,
            "name": "Sulawesi Selatan",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 937,
            "name": "Sligo",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 398,
            "name": "Sondrio",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 460,
            "name": "Soria",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 197,
            "name": "Solol\u00e1",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 510,
            "name": "Sonora",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 95,
            "name": "S\u00e3o Paulo",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 914,
            "name": "Southern Peoples, Nations, and Nationalities",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 349,
            "name": "La Spezia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 157,
            "name": "Saint Petersburg",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 1136,
            "name": "San Pedro de Macor\u00eds",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 638,
            "name": "Sulawesi Barat",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 397,
            "name": "Siracusa",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 1137,
            "name": "S\u00e1nchez Ram\u00edrez",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 1139,
            "name": "Santiago Rodr\u00edguez",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 196,
            "name": "Santa Rosa",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 394,
            "name": "Sassari",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 439,
            "name": "Gipuzkoa (Guip\u00fazcoa)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 644,
            "name": "Sumatra Selatan",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 640,
            "name": "Sulawesi Tengah",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 161,
            "name": "Stavropol Krai",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 1138,
            "name": "Santiago",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 527,
            "name": "Southland",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 399,
            "name": "Sud Sardegna",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 645,
            "name": "Sumatra Utara",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 283,
            "name": "6th of October",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 668,
            "name": "Sucre",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 198,
            "name": "Suchitep\u00e9quez",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 284,
            "name": "Suez",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 395,
            "name": "Savona",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 864,
            "name": "Suceava",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 162,
            "name": "Sverdlovsk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 482,
            "name": "Sarawak",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 461,
            "name": "Tarragona",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 576,
            "name": "Tucum\u00e1n",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 797,
            "name": "Perthshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 798,
            "name": "Powys",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 799,
            "name": "Renfrewshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 800,
            "name": "Ross-Shire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 801,
            "name": "Roxburghshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 400,
            "name": "Taranto",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 164,
            "name": "Republic of Tatarstan",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 511,
            "name": "Tabasco",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 163,
            "name": "Tambov Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 513,
            "name": "Tamaulipas",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 6,
            "name": "Tasmania",
            "country_id": [
                13,
                "Australia"
            ]
        },
        {
            "id": 529,
            "name": "Tasman",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 947,
            "name": "Tyrone",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 462,
            "name": "Teruel",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 401,
            "name": "Teramo",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 457,
            "name": "Santa Cruz de Tenerife",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 915,
            "name": "Tigray",
            "country_id": [
                69,
                "Ethiopia"
            ]
        },
        {
            "id": 528,
            "name": "Taranaki",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 865,
            "name": "Tulcea",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 512,
            "name": "Tlaxcala",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 866,
            "name": "Timi\u0219",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 607,
            "name": "Tamil Nadu",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 405,
            "name": "Trento",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 51,
            "name": "Tennessee",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 463,
            "name": "Toledo",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 97,
            "name": "Tocantins",
            "country_id": [
                31,
                "Brazil"
            ]
        },
        {
            "id": 403,
            "name": "Torino",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 669,
            "name": "Tolima",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 165,
            "name": "Tomsk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 199,
            "name": "Totonicap\u00e1n",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 404,
            "name": "Trapani",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 609,
            "name": "Tripura",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 938,
            "name": "Tipperary",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 867,
            "name": "Teleorman",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 402,
            "name": "Terni",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 484,
            "name": "Terengganu",
            "country_id": [
                157,
                "Malaysia"
            ]
        },
        {
            "id": 407,
            "name": "Trieste",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 608,
            "name": "Telangana",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 166,
            "name": "Tula Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 406,
            "name": "Treviso",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 167,
            "name": "Tver Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 52,
            "name": "Texas",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 169,
            "name": "Tyva Republic",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 168,
            "name": "Tyumen Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 557,
            "name": "Chubut",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 802,
            "name": "Selkirkshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 803,
            "name": "Shropshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 804,
            "name": "Somerset",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 805,
            "name": "South Glamorgan",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 408,
            "name": "Udine",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 170,
            "name": "Udmurtia",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 611,
            "name": "Uttarakhand",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 171,
            "name": "Ulyanovsk Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 610,
            "name": "Uttar Pradesh",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 552,
            "name": "Umm al-Quwain",
            "country_id": [
                2,
                "United Arab Emirates"
            ]
        },
        {
            "id": 53,
            "name": "Utah",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 957,
            "name": "Utrecht",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 464,
            "name": "Val\u00e8ncia (Valencia)",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 575,
            "name": "Tierra del Fuego",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 806,
            "name": "South Humberside",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 807,
            "name": "South Yorkshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 808,
            "name": "Staffordshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 809,
            "name": "Stirlingshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 810,
            "name": "Suffolk",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 409,
            "name": "Varese",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 465,
            "name": "Valladolid",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 55,
            "name": "Virginia",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 670,
            "name": "Valle del Cauca",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 1140,
            "name": "Valverde",
            "country_id": [
                61,
                "Dominican Republic"
            ]
        },
        {
            "id": 678,
            "name": "Vaup\u00e9s",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 411,
            "name": "Verbano-Cusio-Ossola",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 412,
            "name": "Vercelli",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 410,
            "name": "Venezia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 514,
            "name": "Veracruz",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 173,
            "name": "Volgograd Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 418,
            "name": "Araba/\u00c1lava",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 67,
            "name": "Virgin Islands",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 415,
            "name": "Vicenza",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 7,
            "name": "Victoria",
            "country_id": [
                13,
                "Australia"
            ]
        },
        {
            "id": 679,
            "name": "Vichada",
            "country_id": [
                49,
                "Colombia"
            ]
        },
        {
            "id": 868,
            "name": "V\u00e2lcea",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 172,
            "name": "Vladimir Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 174,
            "name": "Vologda Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 869,
            "name": "Vrancea",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 1080,
            "name": "Lai Ch\u00e2u",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1079,
            "name": "L\u00e0o Cai",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1069,
            "name": "H\u00e0 Giang",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1055,
            "name": "Cao B\u1eb1ng",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1094,
            "name": "S\u01a1n La",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1106,
            "name": "Y\u00ean B\u00e1i",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1101,
            "name": "Tuy\u00ean Quang",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1082,
            "name": "L\u1ea1ng S\u01a1n",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1090,
            "name": "Qu\u1ea3ng Ninh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1065,
            "name": "H\u00f2a B\u00ecnh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1084,
            "name": "Ninh B\u00ecnh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1096,
            "name": "Th\u00e1i B\u00ecnh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1098,
            "name": "Thanh H\u00f3a",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1083,
            "name": "Ngh\u1ec7 An",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1073,
            "name": "H\u00e0 T\u0129nh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1089,
            "name": "Qu\u1ea3ng B\u00ecnh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1093,
            "name": "Qu\u1ea3ng Tr\u1ecb",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1102,
            "name": "Th\u1eeba Thi\u00ean - Hu\u1ebf",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1091,
            "name": "Qu\u1ea3ng Nam",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1077,
            "name": "Kon Tum",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1092,
            "name": "Qu\u1ea3ng Ng\u00e3i",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1064,
            "name": "Gia Lai",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1046,
            "name": "B\u00ecnh \u0110\u1ecbnh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1088,
            "name": "Ph\u00fa Y\u00ean",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1059,
            "name": "\u0110\u1eafk L\u1eafk",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1076,
            "name": "Kh\u00e1nh H\u00f2a",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1081,
            "name": "L\u00e2m \u0110\u1ed3ng",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1086,
            "name": "Ninh Thu\u1eadn",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1100,
            "name": "T\u00e2y Ninh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1061,
            "name": "\u0110\u1ed3ng Nai",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1053,
            "name": "B\u00ecnh Thu\u1eadn",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1078,
            "name": "Long An",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1052,
            "name": "B\u00e0 R\u1ecba - V\u0169ng T\u00e0u",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1044,
            "name": "An Giang",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1063,
            "name": "\u0110\u1ed3ng Th\u00e1p",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1097,
            "name": "Ti\u1ec1n Giang",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1075,
            "name": "Ki\u00ean Giang",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1104,
            "name": "V\u0129nh Long",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1054,
            "name": "B\u1ebfn Tre",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1103,
            "name": "Tr\u00e0 Vinh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1095,
            "name": "S\u00f3c Tr\u0103ng",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1048,
            "name": "B\u1eafc K\u1ea1n",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1047,
            "name": "B\u1eafc Giang",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1049,
            "name": "B\u1ea1c Li\u00eau",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1050,
            "name": "B\u1eafc Ninh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1045,
            "name": "B\u00ecnh D\u01b0\u01a1ng",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1051,
            "name": "B\u00ecnh Ph\u01b0\u1edbc",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1056,
            "name": "C\u00e0 Mau",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1067,
            "name": "H\u1ea3i D\u01b0\u01a1ng",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1071,
            "name": "H\u00e0 Nam",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1074,
            "name": "H\u01b0ng Y\u00ean",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1085,
            "name": "Nam \u0110\u1ecbnh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1087,
            "name": "Ph\u00fa Th\u1ecd",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1099,
            "name": "Th\u00e1i Nguy\u00ean",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1105,
            "name": "V\u0129nh Ph\u00fac",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1058,
            "name": "\u0110i\u1ec7n Bi\u00ean",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1062,
            "name": "\u0110\u1eafk N\u00f4ng",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1068,
            "name": "H\u1eadu Giang",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1057,
            "name": "TP C\u1ea7n Th\u01a1",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1060,
            "name": "TP \u0110\u00e0 N\u1eb5ng",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1070,
            "name": "H\u00e0 N\u1ed9i",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1072,
            "name": "TP H\u1ea3i Ph\u00f2ng",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 1066,
            "name": "TP H\u1ed3 Ch\u00ed Minh",
            "country_id": [
                241,
                "Vietnam"
            ]
        },
        {
            "id": 175,
            "name": "Voronezh Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 413,
            "name": "Verona",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 361,
            "name": "Medio Campidano",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 870,
            "name": "Vaslui",
            "country_id": [
                188,
                "Romania"
            ]
        },
        {
            "id": 416,
            "name": "Viterbo",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 54,
            "name": "Vermont",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 414,
            "name": "Vibo Valentia",
            "country_id": [
                109,
                "Italy"
            ]
        },
        {
            "id": 559,
            "name": "Corrientes",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 811,
            "name": "Surrey",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 812,
            "name": "Sutherland",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 813,
            "name": "Tyne and Wear",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 814,
            "name": "Warwickshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 815,
            "name": "West Glamorgan",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 8,
            "name": "Western Australia",
            "country_id": [
                13,
                "Australia"
            ]
        },
        {
            "id": 56,
            "name": "Washington",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 281,
            "name": "New Valley",
            "country_id": [
                65,
                "Egypt"
            ]
        },
        {
            "id": 612,
            "name": "West Bengal",
            "country_id": [
                104,
                "India"
            ]
        },
        {
            "id": 305,
            "name": "Western Cape",
            "country_id": [
                247,
                "South Africa"
            ]
        },
        {
            "id": 921,
            "name": "Waterford",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 531,
            "name": "Wellington",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 939,
            "name": "Westmeath",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 58,
            "name": "Wisconsin",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 530,
            "name": "Waikato",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 532,
            "name": "West Coast",
            "country_id": [
                170,
                "New Zealand"
            ]
        },
        {
            "id": 57,
            "name": "West Virginia",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 941,
            "name": "Wicklow",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 940,
            "name": "Wexford",
            "country_id": [
                101,
                "Ireland"
            ]
        },
        {
            "id": 59,
            "name": "Wyoming",
            "country_id": [
                233,
                "United States"
            ]
        },
        {
            "id": 558,
            "name": "C\u00f3rdoba",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 816,
            "name": "West Lothian",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 817,
            "name": "West Midlands",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 818,
            "name": "West Sussex",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 819,
            "name": "West Yorkshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 820,
            "name": "Wigtownshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 562,
            "name": "Jujuy",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 821,
            "name": "Wiltshire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 822,
            "name": "Worcestershire",
            "country_id": [
                231,
                "United Kingdom"
            ]
        },
        {
            "id": 176,
            "name": "Yamalo-Nenets Autonomous Okrug",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 177,
            "name": "Yaroslavl Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 178,
            "name": "Jewish Autonomous Oblast",
            "country_id": [
                190,
                "Russian Federation"
            ]
        },
        {
            "id": 646,
            "name": "Yogyakarta",
            "country_id": [
                100,
                "Indonesia"
            ]
        },
        {
            "id": 545,
            "name": "Yukon",
            "country_id": [
                38,
                "Canada"
            ]
        },
        {
            "id": 515,
            "name": "Yucat\u00e1n",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 468,
            "name": "Zaragoza",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 572,
            "name": "Santa Cruz",
            "country_id": [
                10,
                "Argentina"
            ]
        },
        {
            "id": 467,
            "name": "Zamora",
            "country_id": [
                68,
                "Spain"
            ]
        },
        {
            "id": 200,
            "name": "Zacapa",
            "country_id": [
                90,
                "Guatemala"
            ]
        },
        {
            "id": 516,
            "name": "Zacatecas",
            "country_id": [
                156,
                "Mexico"
            ]
        },
        {
            "id": 958,
            "name": "Zeeland",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 959,
            "name": "Zuid-Holland",
            "country_id": [
                165,
                "Netherlands"
            ]
        },
        {
            "id": 871,
            "name": "\u5317\u4eac\u5e02",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 891,
            "name": "\u6cb3\u5317\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 902,
            "name": "\u53f0\u6e7e\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 897,
            "name": "\u5409\u6797\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 885,
            "name": "\u5b81\u590f\u56de\u65cf\u81ea\u6cbb\u533a",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 883,
            "name": "\u65b0\u7586\u7ef4\u543e\u5c14\u81ea\u6cbb\u533a",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 893,
            "name": "\u5c71\u897f\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 889,
            "name": "\u5e7f\u897f\u58ee\u65cf\u81ea\u6cbb\u533a",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 872,
            "name": "\u4e0a\u6d77\u5e02",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 874,
            "name": "\u5929\u6d25\u5e02",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 873,
            "name": "\u6d59\u6c5f\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 877,
            "name": "\u91cd\u5e86\u5e02",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 903,
            "name": "\u9999\u6e2f\u7279\u522b\u884c\u653f\u533a",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 884,
            "name": "\u6e56\u5357\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 894,
            "name": "\u4e91\u5357\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 904,
            "name": "\u6fb3\u95e8\u7279\u522b\u884c\u653f\u533a",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 888,
            "name": "\u6d77\u5357\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 898,
            "name": "\u7518\u8083\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 875,
            "name": "\u5b89\u5fbd\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 886,
            "name": "\u5e7f\u4e1c\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 901,
            "name": "\u6c5f\u82cf\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 881,
            "name": "\u5185\u8499\u53e4\u81ea\u6cbb\u533a",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 887,
            "name": "\u897f\u85cf\u81ea\u6cbb\u533a",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 890,
            "name": "\u56db\u5ddd\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 880,
            "name": "\u6cb3\u5357\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 878,
            "name": "\u6c5f\u897f\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 895,
            "name": "\u8fbd\u5b81\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 882,
            "name": "\u6e56\u5317\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 876,
            "name": "\u798f\u5efa\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 896,
            "name": "\u9655\u897f\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 900,
            "name": "\u9752\u6d77\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 879,
            "name": "\u5c71\u4e1c\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 899,
            "name": "\u9ed1\u9f99\u6c5f\u7701",
            "country_id": [
                48,
                "China"
            ]
        },
        {
            "id": 892,
            "name": "\u8d35\u5dde\u7701",
            "country_id": [
                48,
                "China"
            ]
        }
    ],
    "res.country": [
        {
            "id": 3,
            "name": "Afghanistan",
            "vat_label": false,
            "code": "AF"
        },
        {
            "id": 6,
            "name": "Albania",
            "vat_label": false,
            "code": "AL"
        },
        {
            "id": 62,
            "name": "Algeria",
            "vat_label": false,
            "code": "DZ"
        },
        {
            "id": 11,
            "name": "American Samoa",
            "vat_label": false,
            "code": "AS"
        },
        {
            "id": 1,
            "name": "Andorra",
            "vat_label": false,
            "code": "AD"
        },
        {
            "id": 8,
            "name": "Angola",
            "vat_label": false,
            "code": "AO"
        },
        {
            "id": 5,
            "name": "Anguilla",
            "vat_label": false,
            "code": "AI"
        },
        {
            "id": 9,
            "name": "Antarctica",
            "vat_label": false,
            "code": "AQ"
        },
        {
            "id": 4,
            "name": "Antigua and Barbuda",
            "vat_label": false,
            "code": "AG"
        },
        {
            "id": 10,
            "name": "Argentina",
            "vat_label": "CUIT",
            "code": "AR"
        },
        {
            "id": 7,
            "name": "Armenia",
            "vat_label": false,
            "code": "AM"
        },
        {
            "id": 14,
            "name": "Aruba",
            "vat_label": false,
            "code": "AW"
        },
        {
            "id": 13,
            "name": "Australia",
            "vat_label": false,
            "code": "AU"
        },
        {
            "id": 12,
            "name": "Austria",
            "vat_label": "USt",
            "code": "AT"
        },
        {
            "id": 16,
            "name": "Azerbaijan",
            "vat_label": false,
            "code": "AZ"
        },
        {
            "id": 32,
            "name": "Bahamas",
            "vat_label": false,
            "code": "BS"
        },
        {
            "id": 23,
            "name": "Bahrain",
            "vat_label": false,
            "code": "BH"
        },
        {
            "id": 19,
            "name": "Bangladesh",
            "vat_label": false,
            "code": "BD"
        },
        {
            "id": 18,
            "name": "Barbados",
            "vat_label": false,
            "code": "BB"
        },
        {
            "id": 36,
            "name": "Belarus",
            "vat_label": false,
            "code": "BY"
        },
        {
            "id": 20,
            "name": "Belgium",
            "vat_label": "VAT",
            "code": "BE"
        },
        {
            "id": 37,
            "name": "Belize",
            "vat_label": false,
            "code": "BZ"
        },
        {
            "id": 25,
            "name": "Benin",
            "vat_label": false,
            "code": "BJ"
        },
        {
            "id": 27,
            "name": "Bermuda",
            "vat_label": false,
            "code": "BM"
        },
        {
            "id": 33,
            "name": "Bhutan",
            "vat_label": false,
            "code": "BT"
        },
        {
            "id": 29,
            "name": "Bolivia",
            "vat_label": false,
            "code": "BO"
        },
        {
            "id": 30,
            "name": "Bonaire, Sint Eustatius and Saba",
            "vat_label": false,
            "code": "BQ"
        },
        {
            "id": 17,
            "name": "Bosnia and Herzegovina",
            "vat_label": false,
            "code": "BA"
        },
        {
            "id": 35,
            "name": "Botswana",
            "vat_label": false,
            "code": "BW"
        },
        {
            "id": 34,
            "name": "Bouvet Island",
            "vat_label": false,
            "code": "BV"
        },
        {
            "id": 31,
            "name": "Brazil",
            "vat_label": false,
            "code": "BR"
        },
        {
            "id": 105,
            "name": "British Indian Ocean Territory",
            "vat_label": false,
            "code": "IO"
        },
        {
            "id": 28,
            "name": "Brunei Darussalam",
            "vat_label": false,
            "code": "BN"
        },
        {
            "id": 22,
            "name": "Bulgaria",
            "vat_label": "VAT",
            "code": "BG"
        },
        {
            "id": 21,
            "name": "Burkina Faso",
            "vat_label": false,
            "code": "BF"
        },
        {
            "id": 24,
            "name": "Burundi",
            "vat_label": false,
            "code": "BI"
        },
        {
            "id": 116,
            "name": "Cambodia",
            "vat_label": false,
            "code": "KH"
        },
        {
            "id": 47,
            "name": "Cameroon",
            "vat_label": false,
            "code": "CM"
        },
        {
            "id": 38,
            "name": "Canada",
            "vat_label": "HST",
            "code": "CA"
        },
        {
            "id": 52,
            "name": "Cape Verde",
            "vat_label": false,
            "code": "CV"
        },
        {
            "id": 123,
            "name": "Cayman Islands",
            "vat_label": false,
            "code": "KY"
        },
        {
            "id": 40,
            "name": "Central African Republic",
            "vat_label": false,
            "code": "CF"
        },
        {
            "id": 214,
            "name": "Chad",
            "vat_label": false,
            "code": "TD"
        },
        {
            "id": 46,
            "name": "Chile",
            "vat_label": false,
            "code": "CL"
        },
        {
            "id": 48,
            "name": "China",
            "vat_label": false,
            "code": "CN"
        },
        {
            "id": 54,
            "name": "Christmas Island",
            "vat_label": false,
            "code": "CX"
        },
        {
            "id": 39,
            "name": "Cocos (Keeling) Islands",
            "vat_label": false,
            "code": "CC"
        },
        {
            "id": 49,
            "name": "Colombia",
            "vat_label": "NIT",
            "code": "CO"
        },
        {
            "id": 118,
            "name": "Comoros",
            "vat_label": false,
            "code": "KM"
        },
        {
            "id": 42,
            "name": "Congo",
            "vat_label": false,
            "code": "CG"
        },
        {
            "id": 45,
            "name": "Cook Islands",
            "vat_label": false,
            "code": "CK"
        },
        {
            "id": 50,
            "name": "Costa Rica",
            "vat_label": false,
            "code": "CR"
        },
        {
            "id": 97,
            "name": "Croatia",
            "vat_label": "VAT",
            "code": "HR"
        },
        {
            "id": 51,
            "name": "Cuba",
            "vat_label": false,
            "code": "CU"
        },
        {
            "id": 53,
            "name": "Cura\u00e7ao",
            "vat_label": false,
            "code": "CW"
        },
        {
            "id": 55,
            "name": "Cyprus",
            "vat_label": "VAT",
            "code": "CY"
        },
        {
            "id": 56,
            "name": "Czech Republic",
            "vat_label": "VAT",
            "code": "CZ"
        },
        {
            "id": 44,
            "name": "C\u00f4te d'Ivoire",
            "vat_label": false,
            "code": "CI"
        },
        {
            "id": 41,
            "name": "Democratic Republic of the Congo",
            "vat_label": false,
            "code": "CD"
        },
        {
            "id": 59,
            "name": "Denmark",
            "vat_label": "VAT",
            "code": "DK"
        },
        {
            "id": 58,
            "name": "Djibouti",
            "vat_label": false,
            "code": "DJ"
        },
        {
            "id": 60,
            "name": "Dominica",
            "vat_label": false,
            "code": "DM"
        },
        {
            "id": 61,
            "name": "Dominican Republic",
            "vat_label": "RNC",
            "code": "DO"
        },
        {
            "id": 63,
            "name": "Ecuador",
            "vat_label": false,
            "code": "EC"
        },
        {
            "id": 65,
            "name": "Egypt",
            "vat_label": false,
            "code": "EG"
        },
        {
            "id": 209,
            "name": "El Salvador",
            "vat_label": false,
            "code": "SV"
        },
        {
            "id": 87,
            "name": "Equatorial Guinea",
            "vat_label": false,
            "code": "GQ"
        },
        {
            "id": 67,
            "name": "Eritrea",
            "vat_label": false,
            "code": "ER"
        },
        {
            "id": 64,
            "name": "Estonia",
            "vat_label": "VAT",
            "code": "EE"
        },
        {
            "id": 69,
            "name": "Ethiopia",
            "vat_label": false,
            "code": "ET"
        },
        {
            "id": 72,
            "name": "Falkland Islands",
            "vat_label": false,
            "code": "FK"
        },
        {
            "id": 74,
            "name": "Faroe Islands",
            "vat_label": false,
            "code": "FO"
        },
        {
            "id": 71,
            "name": "Fiji",
            "vat_label": false,
            "code": "FJ"
        },
        {
            "id": 70,
            "name": "Finland",
            "vat_label": "VAT",
            "code": "FI"
        },
        {
            "id": 75,
            "name": "France",
            "vat_label": "VAT",
            "code": "FR"
        },
        {
            "id": 79,
            "name": "French Guiana",
            "vat_label": false,
            "code": "GF"
        },
        {
            "id": 174,
            "name": "French Polynesia",
            "vat_label": "N\u00b0 Tahiti",
            "code": "PF"
        },
        {
            "id": 215,
            "name": "French Southern Territories",
            "vat_label": false,
            "code": "TF"
        },
        {
            "id": 76,
            "name": "Gabon",
            "vat_label": false,
            "code": "GA"
        },
        {
            "id": 84,
            "name": "Gambia",
            "vat_label": false,
            "code": "GM"
        },
        {
            "id": 78,
            "name": "Georgia",
            "vat_label": false,
            "code": "GE"
        },
        {
            "id": 57,
            "name": "Germany",
            "vat_label": "VAT",
            "code": "DE"
        },
        {
            "id": 80,
            "name": "Ghana",
            "vat_label": false,
            "code": "GH"
        },
        {
            "id": 81,
            "name": "Gibraltar",
            "vat_label": false,
            "code": "GI"
        },
        {
            "id": 88,
            "name": "Greece",
            "vat_label": "VAT",
            "code": "GR"
        },
        {
            "id": 83,
            "name": "Greenland",
            "vat_label": false,
            "code": "GL"
        },
        {
            "id": 77,
            "name": "Grenada",
            "vat_label": false,
            "code": "GD"
        },
        {
            "id": 86,
            "name": "Guadeloupe",
            "vat_label": false,
            "code": "GP"
        },
        {
            "id": 91,
            "name": "Guam",
            "vat_label": false,
            "code": "GU"
        },
        {
            "id": 90,
            "name": "Guatemala",
            "vat_label": "NIT",
            "code": "GT"
        },
        {
            "id": 82,
            "name": "Guernsey",
            "vat_label": false,
            "code": "GG"
        },
        {
            "id": 85,
            "name": "Guinea",
            "vat_label": false,
            "code": "GN"
        },
        {
            "id": 92,
            "name": "Guinea-Bissau",
            "vat_label": false,
            "code": "GW"
        },
        {
            "id": 93,
            "name": "Guyana",
            "vat_label": false,
            "code": "GY"
        },
        {
            "id": 98,
            "name": "Haiti",
            "vat_label": false,
            "code": "HT"
        },
        {
            "id": 95,
            "name": "Heard Island and McDonald Islands",
            "vat_label": false,
            "code": "HM"
        },
        {
            "id": 236,
            "name": "Holy See (Vatican City State)",
            "vat_label": false,
            "code": "VA"
        },
        {
            "id": 96,
            "name": "Honduras",
            "vat_label": "RTN",
            "code": "HN"
        },
        {
            "id": 94,
            "name": "Hong Kong",
            "vat_label": false,
            "code": "HK"
        },
        {
            "id": 99,
            "name": "Hungary",
            "vat_label": "VAT",
            "code": "HU"
        },
        {
            "id": 108,
            "name": "Iceland",
            "vat_label": false,
            "code": "IS"
        },
        {
            "id": 104,
            "name": "India",
            "vat_label": "GSTIN",
            "code": "IN"
        },
        {
            "id": 100,
            "name": "Indonesia",
            "vat_label": "NPWP",
            "code": "ID"
        },
        {
            "id": 107,
            "name": "Iran",
            "vat_label": false,
            "code": "IR"
        },
        {
            "id": 106,
            "name": "Iraq",
            "vat_label": false,
            "code": "IQ"
        },
        {
            "id": 101,
            "name": "Ireland",
            "vat_label": "VAT",
            "code": "IE"
        },
        {
            "id": 103,
            "name": "Isle of Man",
            "vat_label": false,
            "code": "IM"
        },
        {
            "id": 102,
            "name": "Israel",
            "vat_label": false,
            "code": "IL"
        },
        {
            "id": 109,
            "name": "Italy",
            "vat_label": "VAT",
            "code": "IT"
        },
        {
            "id": 111,
            "name": "Jamaica",
            "vat_label": false,
            "code": "JM"
        },
        {
            "id": 113,
            "name": "Japan",
            "vat_label": false,
            "code": "JP"
        },
        {
            "id": 110,
            "name": "Jersey",
            "vat_label": false,
            "code": "JE"
        },
        {
            "id": 112,
            "name": "Jordan",
            "vat_label": false,
            "code": "JO"
        },
        {
            "id": 124,
            "name": "Kazakhstan",
            "vat_label": false,
            "code": "KZ"
        },
        {
            "id": 114,
            "name": "Kenya",
            "vat_label": false,
            "code": "KE"
        },
        {
            "id": 117,
            "name": "Kiribati",
            "vat_label": false,
            "code": "KI"
        },
        {
            "id": 250,
            "name": "Kosovo",
            "vat_label": false,
            "code": "XK"
        },
        {
            "id": 122,
            "name": "Kuwait",
            "vat_label": false,
            "code": "KW"
        },
        {
            "id": 115,
            "name": "Kyrgyzstan",
            "vat_label": false,
            "code": "KG"
        },
        {
            "id": 125,
            "name": "Laos",
            "vat_label": false,
            "code": "LA"
        },
        {
            "id": 134,
            "name": "Latvia",
            "vat_label": "VAT",
            "code": "LV"
        },
        {
            "id": 126,
            "name": "Lebanon",
            "vat_label": false,
            "code": "LB"
        },
        {
            "id": 131,
            "name": "Lesotho",
            "vat_label": false,
            "code": "LS"
        },
        {
            "id": 130,
            "name": "Liberia",
            "vat_label": false,
            "code": "LR"
        },
        {
            "id": 135,
            "name": "Libya",
            "vat_label": false,
            "code": "LY"
        },
        {
            "id": 128,
            "name": "Liechtenstein",
            "vat_label": false,
            "code": "LI"
        },
        {
            "id": 132,
            "name": "Lithuania",
            "vat_label": "VAT",
            "code": "LT"
        },
        {
            "id": 133,
            "name": "Luxembourg",
            "vat_label": "VAT",
            "code": "LU"
        },
        {
            "id": 147,
            "name": "Macau",
            "vat_label": false,
            "code": "MO"
        },
        {
            "id": 141,
            "name": "Madagascar",
            "vat_label": false,
            "code": "MG"
        },
        {
            "id": 155,
            "name": "Malawi",
            "vat_label": false,
            "code": "MW"
        },
        {
            "id": 157,
            "name": "Malaysia",
            "vat_label": false,
            "code": "MY"
        },
        {
            "id": 154,
            "name": "Maldives",
            "vat_label": false,
            "code": "MV"
        },
        {
            "id": 144,
            "name": "Mali",
            "vat_label": false,
            "code": "ML"
        },
        {
            "id": 152,
            "name": "Malta",
            "vat_label": "VAT",
            "code": "MT"
        },
        {
            "id": 142,
            "name": "Marshall Islands",
            "vat_label": false,
            "code": "MH"
        },
        {
            "id": 149,
            "name": "Martinique",
            "vat_label": false,
            "code": "MQ"
        },
        {
            "id": 150,
            "name": "Mauritania",
            "vat_label": false,
            "code": "MR"
        },
        {
            "id": 153,
            "name": "Mauritius",
            "vat_label": false,
            "code": "MU"
        },
        {
            "id": 246,
            "name": "Mayotte",
            "vat_label": false,
            "code": "YT"
        },
        {
            "id": 156,
            "name": "Mexico",
            "vat_label": "RFC",
            "code": "MX"
        },
        {
            "id": 73,
            "name": "Micronesia",
            "vat_label": false,
            "code": "FM"
        },
        {
            "id": 138,
            "name": "Moldova",
            "vat_label": false,
            "code": "MD"
        },
        {
            "id": 137,
            "name": "Monaco",
            "vat_label": false,
            "code": "MC"
        },
        {
            "id": 146,
            "name": "Mongolia",
            "vat_label": false,
            "code": "MN"
        },
        {
            "id": 139,
            "name": "Montenegro",
            "vat_label": false,
            "code": "ME"
        },
        {
            "id": 151,
            "name": "Montserrat",
            "vat_label": false,
            "code": "MS"
        },
        {
            "id": 136,
            "name": "Morocco",
            "vat_label": false,
            "code": "MA"
        },
        {
            "id": 158,
            "name": "Mozambique",
            "vat_label": false,
            "code": "MZ"
        },
        {
            "id": 145,
            "name": "Myanmar",
            "vat_label": false,
            "code": "MM"
        },
        {
            "id": 159,
            "name": "Namibia",
            "vat_label": false,
            "code": "NA"
        },
        {
            "id": 168,
            "name": "Nauru",
            "vat_label": false,
            "code": "NR"
        },
        {
            "id": 167,
            "name": "Nepal",
            "vat_label": false,
            "code": "NP"
        },
        {
            "id": 165,
            "name": "Netherlands",
            "vat_label": "VAT",
            "code": "NL"
        },
        {
            "id": 160,
            "name": "New Caledonia",
            "vat_label": false,
            "code": "NC"
        },
        {
            "id": 170,
            "name": "New Zealand",
            "vat_label": false,
            "code": "NZ"
        },
        {
            "id": 164,
            "name": "Nicaragua",
            "vat_label": false,
            "code": "NI"
        },
        {
            "id": 161,
            "name": "Niger",
            "vat_label": false,
            "code": "NE"
        },
        {
            "id": 163,
            "name": "Nigeria",
            "vat_label": false,
            "code": "NG"
        },
        {
            "id": 169,
            "name": "Niue",
            "vat_label": false,
            "code": "NU"
        },
        {
            "id": 162,
            "name": "Norfolk Island",
            "vat_label": false,
            "code": "NF"
        },
        {
            "id": 120,
            "name": "North Korea",
            "vat_label": false,
            "code": "KP"
        },
        {
            "id": 143,
            "name": "North Macedonia",
            "vat_label": false,
            "code": "MK"
        },
        {
            "id": 148,
            "name": "Northern Mariana Islands",
            "vat_label": false,
            "code": "MP"
        },
        {
            "id": 166,
            "name": "Norway",
            "vat_label": false,
            "code": "NO"
        },
        {
            "id": 171,
            "name": "Oman",
            "vat_label": false,
            "code": "OM"
        },
        {
            "id": 177,
            "name": "Pakistan",
            "vat_label": false,
            "code": "PK"
        },
        {
            "id": 184,
            "name": "Palau",
            "vat_label": false,
            "code": "PW"
        },
        {
            "id": 172,
            "name": "Panama",
            "vat_label": false,
            "code": "PA"
        },
        {
            "id": 175,
            "name": "Papua New Guinea",
            "vat_label": false,
            "code": "PG"
        },
        {
            "id": 185,
            "name": "Paraguay",
            "vat_label": false,
            "code": "PY"
        },
        {
            "id": 173,
            "name": "Peru",
            "vat_label": false,
            "code": "PE"
        },
        {
            "id": 176,
            "name": "Philippines",
            "vat_label": false,
            "code": "PH"
        },
        {
            "id": 180,
            "name": "Pitcairn Islands",
            "vat_label": false,
            "code": "PN"
        },
        {
            "id": 178,
            "name": "Poland",
            "vat_label": "VAT",
            "code": "PL"
        },
        {
            "id": 183,
            "name": "Portugal",
            "vat_label": "VAT",
            "code": "PT"
        },
        {
            "id": 181,
            "name": "Puerto Rico",
            "vat_label": false,
            "code": "PR"
        },
        {
            "id": 186,
            "name": "Qatar",
            "vat_label": false,
            "code": "QA"
        },
        {
            "id": 188,
            "name": "Romania",
            "vat_label": "VAT",
            "code": "RO"
        },
        {
            "id": 190,
            "name": "Russian Federation",
            "vat_label": false,
            "code": "RU"
        },
        {
            "id": 191,
            "name": "Rwanda",
            "vat_label": false,
            "code": "RW"
        },
        {
            "id": 187,
            "name": "R\u00e9union",
            "vat_label": false,
            "code": "RE"
        },
        {
            "id": 26,
            "name": "Saint Barth\u00e9l\u00e9my",
            "vat_label": false,
            "code": "BL"
        },
        {
            "id": 198,
            "name": "Saint Helena, Ascension and Tristan da Cunha",
            "vat_label": false,
            "code": "SH"
        },
        {
            "id": 119,
            "name": "Saint Kitts and Nevis",
            "vat_label": false,
            "code": "KN"
        },
        {
            "id": 127,
            "name": "Saint Lucia",
            "vat_label": false,
            "code": "LC"
        },
        {
            "id": 140,
            "name": "Saint Martin (French part)",
            "vat_label": false,
            "code": "MF"
        },
        {
            "id": 179,
            "name": "Saint Pierre and Miquelon",
            "vat_label": false,
            "code": "PM"
        },
        {
            "id": 237,
            "name": "Saint Vincent and the Grenadines",
            "vat_label": false,
            "code": "VC"
        },
        {
            "id": 244,
            "name": "Samoa",
            "vat_label": false,
            "code": "WS"
        },
        {
            "id": 203,
            "name": "San Marino",
            "vat_label": false,
            "code": "SM"
        },
        {
            "id": 192,
            "name": "Saudi Arabia",
            "vat_label": false,
            "code": "SA"
        },
        {
            "id": 204,
            "name": "Senegal",
            "vat_label": false,
            "code": "SN"
        },
        {
            "id": 189,
            "name": "Serbia",
            "vat_label": false,
            "code": "RS"
        },
        {
            "id": 194,
            "name": "Seychelles",
            "vat_label": false,
            "code": "SC"
        },
        {
            "id": 202,
            "name": "Sierra Leone",
            "vat_label": false,
            "code": "SL"
        },
        {
            "id": 197,
            "name": "Singapore",
            "vat_label": "GST No.",
            "code": "SG"
        },
        {
            "id": 210,
            "name": "Sint Maarten (Dutch part)",
            "vat_label": false,
            "code": "SX"
        },
        {
            "id": 201,
            "name": "Slovakia",
            "vat_label": "VAT",
            "code": "SK"
        },
        {
            "id": 199,
            "name": "Slovenia",
            "vat_label": "VAT",
            "code": "SI"
        },
        {
            "id": 193,
            "name": "Solomon Islands",
            "vat_label": false,
            "code": "SB"
        },
        {
            "id": 205,
            "name": "Somalia",
            "vat_label": false,
            "code": "SO"
        },
        {
            "id": 247,
            "name": "South Africa",
            "vat_label": false,
            "code": "ZA"
        },
        {
            "id": 89,
            "name": "South Georgia and the South Sandwich Islands",
            "vat_label": false,
            "code": "GS"
        },
        {
            "id": 121,
            "name": "South Korea",
            "vat_label": false,
            "code": "KR"
        },
        {
            "id": 207,
            "name": "South Sudan",
            "vat_label": false,
            "code": "SS"
        },
        {
            "id": 68,
            "name": "Spain",
            "vat_label": "VAT",
            "code": "ES"
        },
        {
            "id": 129,
            "name": "Sri Lanka",
            "vat_label": false,
            "code": "LK"
        },
        {
            "id": 182,
            "name": "State of Palestine",
            "vat_label": false,
            "code": "PS"
        },
        {
            "id": 195,
            "name": "Sudan",
            "vat_label": false,
            "code": "SD"
        },
        {
            "id": 206,
            "name": "Suriname",
            "vat_label": false,
            "code": "SR"
        },
        {
            "id": 200,
            "name": "Svalbard and Jan Mayen",
            "vat_label": false,
            "code": "SJ"
        },
        {
            "id": 212,
            "name": "Swaziland",
            "vat_label": false,
            "code": "SZ"
        },
        {
            "id": 196,
            "name": "Sweden",
            "vat_label": "VAT",
            "code": "SE"
        },
        {
            "id": 43,
            "name": "Switzerland",
            "vat_label": false,
            "code": "CH"
        },
        {
            "id": 211,
            "name": "Syria",
            "vat_label": false,
            "code": "SY"
        },
        {
            "id": 208,
            "name": "S\u00e3o Tom\u00e9 and Pr\u00edncipe",
            "vat_label": false,
            "code": "ST"
        },
        {
            "id": 227,
            "name": "Taiwan",
            "vat_label": false,
            "code": "TW"
        },
        {
            "id": 218,
            "name": "Tajikistan",
            "vat_label": false,
            "code": "TJ"
        },
        {
            "id": 228,
            "name": "Tanzania",
            "vat_label": false,
            "code": "TZ"
        },
        {
            "id": 217,
            "name": "Thailand",
            "vat_label": false,
            "code": "TH"
        },
        {
            "id": 223,
            "name": "Timor-Leste",
            "vat_label": false,
            "code": "TL"
        },
        {
            "id": 216,
            "name": "Togo",
            "vat_label": false,
            "code": "TG"
        },
        {
            "id": 219,
            "name": "Tokelau",
            "vat_label": false,
            "code": "TK"
        },
        {
            "id": 222,
            "name": "Tonga",
            "vat_label": false,
            "code": "TO"
        },
        {
            "id": 225,
            "name": "Trinidad and Tobago",
            "vat_label": false,
            "code": "TT"
        },
        {
            "id": 221,
            "name": "Tunisia",
            "vat_label": false,
            "code": "TN"
        },
        {
            "id": 224,
            "name": "Turkey",
            "vat_label": false,
            "code": "TR"
        },
        {
            "id": 220,
            "name": "Turkmenistan",
            "vat_label": false,
            "code": "TM"
        },
        {
            "id": 213,
            "name": "Turks and Caicos Islands",
            "vat_label": false,
            "code": "TC"
        },
        {
            "id": 226,
            "name": "Tuvalu",
            "vat_label": false,
            "code": "TV"
        },
        {
            "id": 232,
            "name": "USA Minor Outlying Islands",
            "vat_label": false,
            "code": "UM"
        },
        {
            "id": 230,
            "name": "Uganda",
            "vat_label": false,
            "code": "UG"
        },
        {
            "id": 229,
            "name": "Ukraine",
            "vat_label": false,
            "code": "UA"
        },
        {
            "id": 2,
            "name": "United Arab Emirates",
            "vat_label": false,
            "code": "AE"
        },
        {
            "id": 231,
            "name": "United Kingdom",
            "vat_label": "VAT",
            "code": "GB"
        },
        {
            "id": 233,
            "name": "United States",
            "vat_label": "EIN",
            "code": "US"
        },
        {
            "id": 234,
            "name": "Uruguay",
            "vat_label": false,
            "code": "UY"
        },
        {
            "id": 235,
            "name": "Uzbekistan",
            "vat_label": false,
            "code": "UZ"
        },
        {
            "id": 242,
            "name": "Vanuatu",
            "vat_label": false,
            "code": "VU"
        },
        {
            "id": 238,
            "name": "Venezuela",
            "vat_label": false,
            "code": "VE"
        },
        {
            "id": 241,
            "name": "Vietnam",
            "vat_label": false,
            "code": "VN"
        },
        {
            "id": 239,
            "name": "Virgin Islands (British)",
            "vat_label": false,
            "code": "VG"
        },
        {
            "id": 240,
            "name": "Virgin Islands (USA)",
            "vat_label": false,
            "code": "VI"
        },
        {
            "id": 243,
            "name": "Wallis and Futuna",
            "vat_label": false,
            "code": "WF"
        },
        {
            "id": 66,
            "name": "Western Sahara",
            "vat_label": false,
            "code": "EH"
        },
        {
            "id": 245,
            "name": "Yemen",
            "vat_label": false,
            "code": "YE"
        },
        {
            "id": 248,
            "name": "Zambia",
            "vat_label": false,
            "code": "ZM"
        },
        {
            "id": 249,
            "name": "Zimbabwe",
            "vat_label": false,
            "code": "ZW"
        },
        {
            "id": 15,
            "name": "\u00c5land Islands",
            "vat_label": false,
            "code": "AX"
        }
    ],
    "res.lang": [
        {
            "id": 1,
            "name": "English (US)",
            "code": "en_US"
        }
    ],
    "account.tax": [
        {
            "id": 1,
            "name": "Tax 15%",
            "price_include": false,
            "include_base_amount": false,
            "is_base_affected": true,
            "amount_type": "percent",
            "children_tax_ids": [],
            "amount": 15.0
        },
        {
            "id": 2,
            "name": "Purchase Tax 15%",
            "price_include": false,
            "include_base_amount": false,
            "is_base_affected": true,
            "amount_type": "percent",
            "children_tax_ids": [],
            "amount": 15.0
        }
    ],
    "pos.session": {
        "id": 1,
        "name": "POS/00001",
        "user_id": [
            2,
            "Mitchell Admin"
        ],
        "config_id": [
            1,
            "Shop (Mitchell Admin)"
        ],
        "start_at": "2022-04-13 14:55:54",
        "stop_at": false,
        "sequence_number": 1,
        "payment_method_ids": [
            1,
            2,
            3
        ],
        "cash_register_id": [
            2,
            "POS/00001"
        ],
        "state": "opening_control",
        "update_stock_at_closing": false
    },
    "pos.config": {
        "id": 1,
        "name": "Shop",
        "is_installed_account_accountant": false,
        "picking_type_id": [
            13,
            "San Francisco: PoS Orders"
        ],
        "journal_id": [
            9,
            "Point of Sale"
        ],
        "invoice_journal_id": [
            1,
            "Customer Invoices"
        ],
        "currency_id": [
            2,
            "USD"
        ],
        "iface_cashdrawer": false,
        "iface_electronic_scale": false,
        "iface_customer_facing_display": false,
        "iface_customer_facing_display_via_proxy": false,
        "iface_customer_facing_display_local": false,
        "iface_print_via_proxy": false,
        "iface_scan_via_proxy": false,
        "iface_big_scrollbars": false,
        "iface_orderline_customer_notes": false,
        "iface_print_auto": false,
        "iface_print_skip_screen": true,
        "iface_tax_included": "total",
        "iface_start_categ_id": [
            3,
            "Chairs"
        ],
        "iface_available_categ_ids": [],
        "selectable_categ_ids": [
            3,
            2,
            1
        ],
        "iface_display_categ_images": false,
        "restrict_price_control": false,
        "is_margins_costs_accessible_to_every_user": true,
        "cash_control": true,
        "set_maximum_difference": false,
        "receipt_header": false,
        "receipt_footer": false,
        "proxy_ip": false,
        "active": true,
        "uuid": "443a1022-e470-4d7f-8c07-8e0e02969cd5",
        "sequence_id": [
            24,
            "POS Order Shop"
        ],
        "sequence_line_id": [
            25,
            "POS order line Shop"
        ],
        "session_ids": [
            1
        ],
        "current_session_id": [
            1,
            "POS/00001"
        ],
        "current_session_state": "opening_control",
        "number_of_opened_session": 1,
        "last_session_closing_cash": 0.0,
        "last_session_closing_date": false,
        "pos_session_username": "Mitchell Admin",
        "pos_session_state": "opening_control",
        "pos_session_duration": "0",
        "pricelist_id": [
            1,
            "Public Pricelist (USD)"
        ],
        "available_pricelist_ids": [
            1
        ],
        "allowed_pricelist_ids": [
            1,
            2
        ],
        "company_id": [
            1,
            "My Company (San Francisco)"
        ],
        "barcode_nomenclature_id": [
            1,
            "Default Nomenclature"
        ],
        "group_pos_manager_id": [
            49,
            "Point Of Sale / Administrator"
        ],
        "group_pos_user_id": [
            48,
            "Point Of Sale / User"
        ],
        "iface_tipproduct": false,
        "tip_product_id": false,
        "fiscal_position_ids": [],
        "default_fiscal_position_id": false,
        "default_bill_ids": [
            1,
            2,
            3,
            4,
            5,
            6,
            7,
            8,
            9,
            10,
            11,
            12,
            13,
            14,
            15
        ],
        "use_pricelist": false,
        "tax_regime": false,
        "tax_regime_selection": false,
        "start_category": true,
        "limit_categories": false,
        "module_account": true,
        "module_pos_restaurant": false,
        "module_pos_discount": false,
        "module_pos_loyalty": false,
        "module_pos_mercury": false,
        "product_configurator": true,
        "is_posbox": false,
        "is_header_or_footer": false,
        "module_pos_hr": false,
        "amount_authorized_diff": 0.0,
        "payment_method_ids": [
            1,
            2,
            3
        ],
        "company_has_template": true,
        "current_user_id": [
            2,
            "Mitchell Admin"
        ],
        "other_devices": false,
        "rounding_method": false,
        "cash_rounding": false,
        "only_round_cash_method": false,
        "has_active_session": true,
        "manual_discount": true,
        "ship_later": false,
        "warehouse_id": [
            1,
            "San Francisco"
        ],
        "route_id": false,
        "picking_policy": "direct",
        "limited_products_loading": false,
        "limited_products_amount": 20000,
        "product_load_background": false,
        "limited_partners_loading": false,
        "limited_partners_amount": 100,
        "partner_load_background": false,
        "__last_update": "2022-04-13 14:54:06",
        "display_name": "Shop (Mitchell Admin)",
        "create_uid": [
            1,
            "OdooBot"
        ],
        "create_date": "2022-04-13 14:54:02",
        "write_uid": [
            1,
            "OdooBot"
        ],
        "write_date": "2022-04-13 14:54:06",
        "module_pos_iot": false,
        "epson_printer_ip": false,
        "use_proxy": false
    },
    "pos.bill": [
        {
            "id": 1,
            "name": "0.01",
            "value": 0.01
        },
        {
            "id": 2,
            "name": "0.02",
            "value": 0.02
        },
        {
            "id": 3,
            "name": "0.05",
            "value": 0.05
        },
        {
            "id": 4,
            "name": "0.10",
            "value": 0.1
        },
        {
            "id": 5,
            "name": "0.20",
            "value": 0.2
        },
        {
            "id": 6,
            "name": "0.50",
            "value": 0.5
        },
        {
            "id": 7,
            "name": "1.00",
            "value": 1.0
        },
        {
            "id": 8,
            "name": "2.00",
            "value": 2.0
        },
        {
            "id": 9,
            "name": "5.00",
            "value": 5.0
        },
        {
            "id": 10,
            "name": "10.00",
            "value": 10.0
        },
        {
            "id": 11,
            "name": "20.00",
            "value": 20.0
        },
        {
            "id": 12,
            "name": "50.00",
            "value": 50.0
        },
        {
            "id": 13,
            "name": "100.00",
            "value": 100.0
        },
        {
            "id": 14,
            "name": "200.00",
            "value": 200.0
        },
        {
            "id": 15,
            "name": "500.00",
            "value": 500.0
        }
    ],
    "res.partner": [
        {
            "id": 14,
            "name": "Azure Interior",
            "street": "4557 De Silva St",
            "city": "Fremont",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(870)-931-0505",
            "zip": "94538",
            "mobile": false,
            "email": "azure.Interior24@example.com",
            "barcode": "0420800000008",
            "write_date": "2022-04-13 14:54:02",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 26,
            "name": "Brandon Freeman",
            "street": "4557 De Silva St",
            "city": "Fremont",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(355)-687-3262",
            "zip": "94538",
            "mobile": false,
            "email": "brandon.freeman55@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 33,
            "name": "Colleen Diaz",
            "street": "4557 De Silva St",
            "city": "Fremont",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(255)-595-8393",
            "zip": "94538",
            "mobile": false,
            "email": "colleen.diaz83@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 27,
            "name": "Nicole Ford",
            "street": "4557 De Silva St",
            "city": "Fremont",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(946)-638-6034",
            "zip": "94538",
            "mobile": false,
            "email": "nicole.ford75@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 10,
            "name": "Deco Addict",
            "street": "77 Santa Barbara Rd",
            "city": "Pleasant Hill",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(603)-996-3829",
            "zip": "94523",
            "mobile": false,
            "email": "deco.addict82@example.com",
            "barcode": "0420200000004",
            "write_date": "2022-04-13 14:54:02",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 35,
            "name": "Addison Olson",
            "street": "77 Santa Barbara Rd",
            "city": "Pleasant Hill",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(223)-399-7637",
            "zip": "94523",
            "mobile": false,
            "email": "addison.olson28@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 18,
            "name": "Douglas Fletcher",
            "street": "77 Santa Barbara Rd",
            "city": "Pleasant Hill",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(132)-553-7242",
            "zip": "94523",
            "mobile": false,
            "email": "douglas.fletcher51@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 19,
            "name": "Floyd Steward",
            "street": "77 Santa Barbara Rd",
            "city": "Pleasant Hill",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(145)-138-3401",
            "zip": "94523",
            "mobile": false,
            "email": "floyd.steward34@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 11,
            "name": "Gemini Furniture",
            "street": "317 Fairchild Dr",
            "city": "Fairfield",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(941)-284-4875",
            "zip": "94535",
            "mobile": false,
            "email": "gemini.furniture39@example.com",
            "barcode": "0420300000003",
            "write_date": "2022-04-13 14:54:02",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 20,
            "name": "Edwin Hansen",
            "street": "317 Fairchild Dr",
            "city": "Fairfield",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(943)-352-2555",
            "zip": "94535",
            "mobile": false,
            "email": "edwin.hansen58@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:47",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 22,
            "name": "Jesse Brown",
            "street": "317 Fairchild Dr",
            "city": "Fairfield",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(829)-386-3277",
            "zip": "94535",
            "mobile": false,
            "email": "jesse.brown74@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:47",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 31,
            "name": "Oscar Morgan",
            "street": "317 Fairchild Dr",
            "city": "Fairfield",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(561)-239-1744",
            "zip": "94535",
            "mobile": false,
            "email": "oscar.morgan11@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:47",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 23,
            "name": "Soham Palmer",
            "street": "317 Fairchild Dr",
            "city": "Fairfield",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(379)-167-2040",
            "zip": "94535",
            "mobile": false,
            "email": "soham.palmer15@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:47",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 15,
            "name": "Lumber Inc",
            "street": "1337 N San Joaquin St",
            "city": "Stockton",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(828)-316-0593",
            "zip": "95202",
            "mobile": false,
            "email": "lumber-inv92@example.com",
            "barcode": "0421800000005",
            "write_date": "2022-04-13 14:54:02",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 34,
            "name": "Lorraine Douglas",
            "street": "1337 N San Joaquin St",
            "city": "Stockton",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(443)-648-9155",
            "zip": "95202",
            "mobile": false,
            "email": "lorraine.douglas35@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:47",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 41,
            "name": "My Company (Chicago)",
            "street": "90 Streets Avenue",
            "city": "Chicago",
            "state_id": [
                22,
                "Illinois (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "+1 312 349 3030",
            "zip": "60610",
            "mobile": false,
            "email": "chicago@yourcompany.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:53",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 42,
            "name": "Jeff Lawson",
            "street": "90 Streets Avenue",
            "city": "Chicago",
            "state_id": [
                22,
                "Illinois (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(461)-417-6587",
            "zip": "60610",
            "mobile": false,
            "email": "jeff.lawson52@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:53",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 1,
            "name": "My Company (San Francisco)",
            "street": "250 Executive Park Blvd, Suite 3400",
            "city": "San Francisco",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "+1 (650) 555-0111 ",
            "zip": "94134",
            "mobile": false,
            "email": "info@yourcompany.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:53",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 39,
            "name": "Chester Reed",
            "street": "250 Executive Park Blvd, Suite 3400",
            "city": "San Francisco",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(979)-904-8902",
            "zip": "94134",
            "mobile": false,
            "email": "chester.reed79@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:53",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 40,
            "name": "Dwayne Newman",
            "street": "250 Executive Park Blvd, Suite 3400",
            "city": "San Francisco",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(614)-177-4937",
            "zip": "94134",
            "mobile": false,
            "email": "dwayne.newman28@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:53",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 12,
            "name": "Ready Mat",
            "street": "7500 W Linne Road",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(803)-873-6126",
            "zip": "95304",
            "mobile": false,
            "email": "ready.mat28@example.com",
            "barcode": "0420700000009",
            "write_date": "2022-04-13 14:54:02",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 21,
            "name": "Billy Fox",
            "street": "7500 W Linne Road",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(915)-498-5611",
            "zip": "95304",
            "mobile": false,
            "email": "billy.fox45@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 25,
            "name": "Edith Sanchez",
            "street": "7500 W Linne Road",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(938)-175-2048",
            "zip": "95304",
            "mobile": false,
            "email": "edith.sanchez68@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 37,
            "name": "Julie Richards",
            "street": "7500 W Linne Road",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(225)-148-7811",
            "zip": "95304",
            "mobile": false,
            "email": "julie.richards84@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 24,
            "name": "Kim Snyder",
            "street": "7500 W Linne Road",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(215)-379-4865",
            "zip": "95304",
            "mobile": false,
            "email": "kim.snyder96@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 36,
            "name": "Sandra Neal",
            "street": "7500 W Linne Road",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(430)-371-7293",
            "zip": "95304",
            "mobile": false,
            "email": "sandra.neal80@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 30,
            "name": "Theodore Gardner",
            "street": "7500 W Linne Road",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(186)-612-6561",
            "zip": "95304",
            "mobile": false,
            "email": "theodore.gardner36@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 38,
            "name": "Travis Mendoza",
            "street": "7500 W Linne Road",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(840)-944-8661",
            "zip": "95304",
            "mobile": false,
            "email": "travis.mendoza24@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 13,
            "name": "The Jackson Group",
            "street": "1611 Peony Dr",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(334)-502-1024",
            "zip": "95377",
            "mobile": false,
            "email": "jackson.group82@example.com",
            "barcode": "0421000000003",
            "write_date": "2022-04-13 14:54:02",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 29,
            "name": "Gordon Owens",
            "street": "1611 Peony Dr",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(336)-723-6569",
            "zip": "95377",
            "mobile": false,
            "email": "gordon.owens47@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:47",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 28,
            "name": "Toni Rhodes",
            "street": "1611 Peony Dr",
            "city": "Tracy",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(198)-539-4948",
            "zip": "95377",
            "mobile": false,
            "email": "toni.rhodes11@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:47",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 9,
            "name": "Wood Corner",
            "street": "1839 Arbor Way",
            "city": "Turlock",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(623)-853-7197",
            "zip": "95380",
            "mobile": false,
            "email": "wood.corner26@example.com",
            "barcode": "0420100000005",
            "write_date": "2022-04-13 14:54:02",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 17,
            "name": "Ron Gibson",
            "street": "1839 Arbor Way",
            "city": "Turlock",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(976)-397-4091",
            "zip": "95380",
            "mobile": false,
            "email": "ron.gibson76@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 32,
            "name": "Tom Ruiz",
            "street": "1839 Arbor Way",
            "city": "Turlock",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(102)-834-1602",
            "zip": "95380",
            "mobile": false,
            "email": "tom.ruiz89@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 16,
            "name": "Willie Burke",
            "street": "1839 Arbor Way",
            "city": "Turlock",
            "state_id": [
                13,
                "California (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(846)-523-2111",
            "zip": "95380",
            "mobile": false,
            "email": "willie.burke80@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 8,
            "name": "Joel Willis",
            "street": "858 Lynn Street",
            "city": "Bayonne",
            "state_id": [
                33,
                "New Jersey (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(683)-556-5104",
            "zip": "07002",
            "mobile": false,
            "email": "joel.willis63@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:53:47",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 7,
            "name": "Marc Demo",
            "street": "3575  Buena Vista Avenue",
            "city": "Eugene",
            "state_id": [
                656,
                "C\u00f3rdoba (CO)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "(441)-695-2334",
            "zip": "97401",
            "mobile": false,
            "email": "mark.brown23@example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:54:02",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        },
        {
            "id": 3,
            "name": "Mitchell Admin",
            "street": "215 Vine St",
            "city": "Scranton",
            "state_id": [
                47,
                "Pennsylvania (US)"
            ],
            "country_id": [
                233,
                "United States"
            ],
            "vat": false,
            "lang": "en_US",
            "phone": "+1 555-555-5555",
            "zip": "18503",
            "mobile": false,
            "email": "admin@yourcompany.example.com",
            "barcode": false,
            "write_date": "2022-04-13 14:55:48",
            "property_account_position_id": false,
            "property_product_pricelist": [
                1,
                "Public Pricelist (USD)"
            ]
        }
    ],
    "stock.picking.type": {
        "id": 13,
        "use_create_lots": true,
        "use_existing_lots": true
    },
    "res.users": {
        "id": 2,
        "name": "Mitchell Admin",
        "role": "manager"
    },
    "product.pricelist": [
        {
            "id": 1,
            "name": "Public Pricelist",
            "display_name": "Public Pricelist (USD)",
            "discount_policy": "with_discount",
            "items": []
        }
    ],
    "res.currency": {
        "id": 2,
        "name": "USD",
        "symbol": "$",
        "position": "before",
        "rounding": 0.01,
        "rate": 1.0,
        "decimal_places": 2
    },
    "pos.category": [
        {
            "id": 3,
            "name": "Chairs",
            "parent_id": false,
            "child_id": [],
            "write_date": "2022-04-13 14:54:02"
        },
        {
            "id": 2,
            "name": "Desks",
            "parent_id": false,
            "child_id": [],
            "write_date": "2022-04-13 14:54:02"
        },
        {
            "id": 1,
            "name": "Miscellaneous",
            "parent_id": false,
            "child_id": [],
            "write_date": "2022-04-13 14:54:02"
        }
    ],
    "product.product": [
        {
            "id": 49,
            "display_name": "Whiteboard Pen",
            "lst_price": 1.2,
            "standard_price": 0.0,
            "categ_id": [
                9,
                "All / Consumable"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "CONS_0001",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                41,
                "[CONS_0001] Whiteboard Pen"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 9,
                "name": "Consumable",
                "parent_id": [
                    1,
                    "All"
                ],
                "parent": {
                    "id": 1,
                    "name": "All",
                    "parent_id": false,
                    "parent": null
                }
            }
        },
        {
            "id": 15,
            "display_name": "Customizable Desk (Aluminium, Black)",
            "lst_price": 800.4,
            "standard_price": 500.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                2,
                "Desks"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "DESK0004",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": "160x80cm, with large legs.",
            "description": false,
            "product_tmpl_id": [
                9,
                "Customizable Desk"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:53:43",
            "available_in_pos": true,
            "attribute_line_ids": [
                1,
                2
            ],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 16,
            "display_name": "Corner Desk Right Sit",
            "lst_price": 147.0,
            "standard_price": 600.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                2,
                "Desks"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "E-COM06",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                10,
                "[E-COM06] Corner Desk Right Sit"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 17,
            "display_name": "Large Cabinet",
            "lst_price": 320.0,
            "standard_price": 800.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "E-COM07",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                11,
                "[E-COM07] Large Cabinet"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 18,
            "display_name": "Storage Box",
            "lst_price": 15.8,
            "standard_price": 14.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "E-COM08",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                12,
                "[E-COM08] Storage Box"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 19,
            "display_name": "Large Desk",
            "lst_price": 1799.0,
            "standard_price": 1299.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                2,
                "Desks"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "E-COM09",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                13,
                "[E-COM09] Large Desk"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 20,
            "display_name": "Pedal Bin",
            "lst_price": 47.0,
            "standard_price": 10.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "E-COM10",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                14,
                "[E-COM10] Pedal Bin"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 21,
            "display_name": "Cabinet with Doors",
            "lst_price": 140.0,
            "standard_price": 120.5,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "E-COM11",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                15,
                "[E-COM11] Cabinet with Doors"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 23,
            "display_name": "Conference Chair (Steel)",
            "lst_price": 33.0,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                3,
                "Chairs"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "E-COM12",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                16,
                "Conference Chair"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [
                3
            ],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 24,
            "display_name": "Conference Chair (Aluminium)",
            "lst_price": 39.4,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                3,
                "Chairs"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "E-COM13",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                16,
                "Conference Chair"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [
                3
            ],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 42,
            "display_name": "Desk Organizer",
            "lst_price": 5.1000000000000005,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": "2300001000008",
            "default_code": "FURN_0001",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                34,
                "[FURN_0001] Desk Organizer"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [
                4,
                5
            ],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 45,
            "display_name": "Desk Pad",
            "lst_price": 1.98,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0002",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                37,
                "[FURN_0002] Desk Pad"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 47,
            "display_name": "LED Lamp",
            "lst_price": 0.9,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0003",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                39,
                "[FURN_0003] LED Lamp"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 41,
            "display_name": "Letter Tray",
            "lst_price": 4.8,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0004",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                33,
                "[FURN_0004] Letter Tray"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 43,
            "display_name": "Magnetic Board",
            "lst_price": 1.98,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": "2301000000006",
            "default_code": "FURN_0005",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                35,
                "[FURN_0005] Magnetic Board"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 44,
            "display_name": "Monitor Stand",
            "lst_price": 3.19,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0006",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                36,
                "[FURN_0006] Monitor Stand"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 48,
            "display_name": "Newspaper Rack",
            "lst_price": 1.28,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": "2100001000004",
            "default_code": "FURN_0007",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                40,
                "[FURN_0007] Newspaper Rack"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 40,
            "display_name": "Small Shelf",
            "lst_price": 2.83,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0008",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                32,
                "[FURN_0008] Small Shelf"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 39,
            "display_name": "Wall Shelf Unit",
            "lst_price": 1.98,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": "2100002000003",
            "default_code": "FURN_0009",
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                31,
                "[FURN_0009] Wall Shelf Unit"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 12,
            "display_name": "Customizable Desk (Steel, White)",
            "lst_price": 750.0,
            "standard_price": 500.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                2,
                "Desks"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0096",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": "160x80cm, with large legs.",
            "description": false,
            "product_tmpl_id": [
                9,
                "Customizable Desk"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:53:53",
            "available_in_pos": true,
            "attribute_line_ids": [
                1,
                2
            ],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 13,
            "display_name": "Customizable Desk (Steel, Black)",
            "lst_price": 750.0,
            "standard_price": 500.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                2,
                "Desks"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0097",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": "160x80cm, with large legs.",
            "description": false,
            "product_tmpl_id": [
                9,
                "Customizable Desk"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:53:43",
            "available_in_pos": true,
            "attribute_line_ids": [
                1,
                2
            ],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 14,
            "display_name": "Customizable Desk (Aluminium, White)",
            "lst_price": 800.4,
            "standard_price": 500.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                2,
                "Desks"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0098",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": "160x80cm, with large legs.",
            "description": false,
            "product_tmpl_id": [
                9,
                "Customizable Desk"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:53:43",
            "available_in_pos": true,
            "attribute_line_ids": [
                1,
                2
            ],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 25,
            "display_name": "Office Chair Black",
            "lst_price": 120.5,
            "standard_price": 180.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                3,
                "Chairs"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0269",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                17,
                "[FURN_0269] Office Chair Black"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 30,
            "display_name": "Individual Workplace",
            "lst_price": 885.0,
            "standard_price": 876.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_0789",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                22,
                "[FURN_0789] Individual Workplace"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 26,
            "display_name": "Corner Desk Left Sit",
            "lst_price": 85.0,
            "standard_price": 78.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                2,
                "Desks"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_1118",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                18,
                "[FURN_1118] Corner Desk Left Sit"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 31,
            "display_name": "Acoustic Bloc Screens",
            "lst_price": 295.0,
            "standard_price": 287.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_6666",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                23,
                "[FURN_6666] Acoustic Bloc Screens"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 34,
            "display_name": "Large Meeting Table",
            "lst_price": 4000.0,
            "standard_price": 4500.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_6741",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": "Conference room table",
            "description": false,
            "product_tmpl_id": [
                26,
                "[FURN_6741] Large Meeting Table"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 5,
            "display_name": "Office Chair",
            "lst_price": 70.0,
            "standard_price": 55.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                3,
                "Chairs"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_7777",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                5,
                "[FURN_7777] Office Chair"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 8,
            "display_name": "Desk Combination",
            "lst_price": 450.0,
            "standard_price": 300.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                2,
                "Desks"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_7800",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": "Desk combination, black-brown: chair + desk + drawer.",
            "description": false,
            "product_tmpl_id": [
                8,
                "[FURN_7800] Desk Combination"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 29,
            "display_name": "Desk Stand with Screen",
            "lst_price": 2100.0,
            "standard_price": 2010.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_7888",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                21,
                "[FURN_7888] Desk Stand with Screen"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 33,
            "display_name": "Four Person Desk",
            "lst_price": 2350.0,
            "standard_price": 2500.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                2,
                "Desks"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_8220",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": "Four person modern office workstation",
            "description": false,
            "product_tmpl_id": [
                25,
                "[FURN_8220] Four Person Desk"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 32,
            "display_name": "Drawer",
            "lst_price": 110.5,
            "standard_price": 100.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_8855",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": "<p>Drawer with two routing possiblities.</p>",
            "product_tmpl_id": [
                24,
                "[FURN_8855] Drawer"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 6,
            "display_name": "Office Lamp",
            "lst_price": 40.0,
            "standard_price": 35.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_8888",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                6,
                "[FURN_8888] Office Lamp"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 27,
            "display_name": "Drawer Black",
            "lst_price": 25.0,
            "standard_price": 20.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_8900",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                19,
                "[FURN_8900] Drawer Black"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 35,
            "display_name": "Three-Seat Sofa",
            "lst_price": 1500.0,
            "standard_price": 1000.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_8999",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": "Three Seater Sofa with Lounger in Steel Grey Colour",
            "description": false,
            "product_tmpl_id": [
                27,
                "[FURN_8999] Three-Seat Sofa"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 28,
            "display_name": "Flipover",
            "lst_price": 1950.0,
            "standard_price": 1700.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_9001",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                20,
                "[FURN_9001] Flipover"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 7,
            "display_name": "Office Design Software",
            "lst_price": 280.0,
            "standard_price": 235.0,
            "categ_id": [
                7,
                "All / Saleable / Software"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": "FURN_9999",
            "to_weight": false,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                7,
                "[FURN_9999] Office Design Software"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 7,
                "name": "Software",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 4,
            "display_name": "Virtual Home Staging",
            "lst_price": 38.25,
            "standard_price": 25.5,
            "categ_id": [
                5,
                "All / Saleable / Services"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": false,
            "to_weight": false,
            "uom_id": [
                4,
                "Hours"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                4,
                "Virtual Home Staging"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 5,
                "name": "Services",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 3,
            "display_name": "Virtual Interior Design",
            "lst_price": 30.75,
            "standard_price": 20.5,
            "categ_id": [
                5,
                "All / Saleable / Services"
            ],
            "pos_categ_id": [
                1,
                "Miscellaneous"
            ],
            "taxes_id": [],
            "barcode": false,
            "default_code": false,
            "to_weight": false,
            "uom_id": [
                4,
                "Hours"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                3,
                "Virtual Interior Design"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 5,
                "name": "Services",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        },
        {
            "id": 46,
            "display_name": "Whiteboard",
            "lst_price": 1.7,
            "standard_price": 0.0,
            "categ_id": [
                8,
                "All / Saleable / Office Furniture"
            ],
            "pos_categ_id": false,
            "taxes_id": [],
            "barcode": false,
            "default_code": false,
            "to_weight": true,
            "uom_id": [
                1,
                "Units"
            ],
            "description_sale": false,
            "description": false,
            "product_tmpl_id": [
                38,
                "Whiteboard"
            ],
            "tracking": "none",
            "write_date": "2022-04-13 14:54:02",
            "available_in_pos": true,
            "attribute_line_ids": [],
            "active": true,
            "categ": {
                "id": 8,
                "name": "Office Furniture",
                "parent_id": [
                    2,
                    "All / Saleable"
                ],
                "parent": {
                    "id": 2,
                    "name": "Saleable",
                    "parent_id": [
                        1,
                        "All"
                    ],
                    "parent": {
                        "id": 1,
                        "name": "All",
                        "parent_id": false,
                        "parent": null
                    }
                }
            }
        }
    ],
    "product.packaging": [],
    "account.cash.rounding": [],
    "pos.payment.method": [
        {
            "id": 1,
            "name": "Cash",
            "is_cash_count": true,
            "use_payment_terminal": false,
            "split_transactions": false,
            "type": "cash"
        },
        {
            "id": 2,
            "name": "Bank",
            "is_cash_count": false,
            "use_payment_terminal": false,
            "split_transactions": false,
            "type": "bank"
        },
        {
            "id": 3,
            "name": "Customer Account",
            "is_cash_count": false,
            "use_payment_terminal": false,
            "split_transactions": true,
            "type": "pay_later"
        }
    ],
    "account.fiscal.position": [],
    "account.bank.statement": {
        "id": 2,
        "balance_start": 0.0
    },
    "version": {
        "server_version": "15.4alpha1+e",
        "server_version_info": [
            15,
            4,
            0,
            "alpha",
            1,
            "e"
        ],
        "server_serie": "15.4",
        "protocol_version": 1
    },
    "units_by_id": {
        "6": {
            "id": 6,
            "name": "mm",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 1000.0,
            "factor_inv": 0.001,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "mm",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "13": {
            "id": 13,
            "name": "g",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 1000.0,
            "factor_inv": 0.001,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "g",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "8": {
            "id": 8,
            "name": "cm",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 100.0,
            "factor_inv": 0.01,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 100.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "cm",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "25": {
            "id": 25,
            "name": "in\u00b3",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 61.0237,
            "factor_inv": 0.0163870758410257,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 61.0237,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "in\u00b3",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "17": {
            "id": 17,
            "name": "in",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 39.3701,
            "factor_inv": 0.025399986284007407,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 39.3701,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "in",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "16": {
            "id": 16,
            "name": "oz",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 35.274,
            "factor_inv": 0.02834949254408346,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 35.274,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "oz",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "22": {
            "id": 22,
            "name": "fl oz (US)",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 33.814,
            "factor_inv": 0.029573549417401077,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 33.814,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "fl oz (US)",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "21": {
            "id": 21,
            "name": "ft\u00b2",
            "category_id": [
                5,
                "Surface"
            ],
            "factor": 10.76391,
            "factor_inv": 0.09290304359661128,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 10.76391,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "ft\u00b2",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "4": {
            "id": 4,
            "name": "Hours",
            "category_id": [
                3,
                "Working Time"
            ],
            "factor": 8.0,
            "factor_inv": 0.125,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 8.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "Hours",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "18": {
            "id": 18,
            "name": "ft",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 3.28084,
            "factor_inv": 0.3047999902464003,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 3.28084,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "ft",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "15": {
            "id": 15,
            "name": "lb",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 2.20462,
            "factor_inv": 0.45359290943563974,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 2.20462,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "lb",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "19": {
            "id": 19,
            "name": "yd",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 1.09361,
            "factor_inv": 0.9144027578387177,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 1.09361,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "yd",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "23": {
            "id": 23,
            "name": "qt (US)",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 1.05669,
            "factor_inv": 0.9463513423993792,
            "rounding": 0.01,
            "active": true,
            "uom_type": "smaller",
            "ratio": 1.05669,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "qt (US)",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "1": {
            "id": 1,
            "name": "Units",
            "category_id": [
                1,
                "Unit"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "Units",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": true
        },
        "3": {
            "id": 3,
            "name": "Days",
            "category_id": [
                3,
                "Working Time"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "Days",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "5": {
            "id": 5,
            "name": "m",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "m",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "9": {
            "id": 9,
            "name": "m\u00b2",
            "category_id": [
                5,
                "Surface"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "m\u00b2",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "10": {
            "id": 10,
            "name": "L",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "L",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "12": {
            "id": 12,
            "name": "kg",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 1.0,
            "factor_inv": 1.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "reference",
            "ratio": 1.0,
            "color": 7,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "kg",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "24": {
            "id": 24,
            "name": "gal (US)",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 0.26417217685798894,
            "factor_inv": 3.78541,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 3.78541,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "gal (US)",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "2": {
            "id": 2,
            "name": "Dozens",
            "category_id": [
                1,
                "Unit"
            ],
            "factor": 0.08333333333333333,
            "factor_inv": 12.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 12.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "Dozens",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": true
        },
        "26": {
            "id": 26,
            "name": "ft\u00b3",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 0.035314724827664144,
            "factor_inv": 28.316799999999997,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 28.316799999999997,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "ft\u00b3",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "7": {
            "id": 7,
            "name": "km",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 0.001,
            "factor_inv": 1000.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "km",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "11": {
            "id": 11,
            "name": "m\u00b3",
            "category_id": [
                6,
                "Volume"
            ],
            "factor": 0.001,
            "factor_inv": 1000.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "m\u00b3",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "14": {
            "id": 14,
            "name": "t",
            "category_id": [
                2,
                "Weight"
            ],
            "factor": 0.001,
            "factor_inv": 1000.0,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 1000.0,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "t",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        },
        "20": {
            "id": 20,
            "name": "mi",
            "category_id": [
                4,
                "Length / Distance"
            ],
            "factor": 0.0006213727366498068,
            "factor_inv": 1609.34,
            "rounding": 0.01,
            "active": true,
            "uom_type": "bigger",
            "ratio": 1609.34,
            "color": 0,
            "__last_update": "2022-04-13 14:53:33",
            "display_name": "mi",
            "create_uid": [
                1,
                "OdooBot"
            ],
            "create_date": "2022-04-13 14:53:33",
            "write_uid": [
                1,
                "OdooBot"
            ],
            "write_date": "2022-04-13 14:53:33",
            "is_pos_groupable": false
        }
    },
    "taxes_by_id": {
        "1": {
            "id": 1,
            "name": "Tax 15%",
            "price_include": false,
            "include_base_amount": false,
            "is_base_affected": true,
            "amount_type": "percent",
            "children_tax_ids": [],
            "amount": 15.0
        },
        "2": {
            "id": 2,
            "name": "Purchase Tax 15%",
            "price_include": false,
            "include_base_amount": false,
            "is_base_affected": true,
            "amount_type": "percent",
            "children_tax_ids": [],
            "amount": 15.0
        }
    },
    "default_pricelist": {
        "id": 1,
        "name": "Public Pricelist",
        "display_name": "Public Pricelist (USD)",
        "discount_policy": "with_discount",
        "items": []
    },
    "attributes_by_ptal_id": {
        "4": {
            "id": 4,
            "name": "Size",
            "display_type": "radio",
            "values": [
                {
                    "id": 7,
                    "name": "S",
                    "is_custom": false,
                    "html_color": false,
                    "price_extra": 0.0
                },
                {
                    "id": 8,
                    "name": "M",
                    "is_custom": false,
                    "html_color": false,
                    "price_extra": 0.0
                },
                {
                    "id": 9,
                    "name": "L",
                    "is_custom": false,
                    "html_color": false,
                    "price_extra": 0.0
                }
            ]
        },
        "5": {
            "id": 5,
            "name": "Fabric",
            "display_type": "select",
            "values": [
                {
                    "id": 10,
                    "name": "Plastic",
                    "is_custom": false,
                    "html_color": false,
                    "price_extra": 0.0
                },
                {
                    "id": 11,
                    "name": "Leather",
                    "is_custom": false,
                    "html_color": false,
                    "price_extra": 0.0
                },
                {
                    "id": 12,
                    "name": "Custom",
                    "is_custom": true,
                    "html_color": false,
                    "price_extra": 0.0
                }
            ]
        }
    }
};
