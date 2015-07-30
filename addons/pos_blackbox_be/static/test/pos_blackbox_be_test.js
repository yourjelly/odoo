odoo.define_section('pos_blackbox_be.Order', ['point_of_sale.models'], function (test, mock) {
    function mock_pos() {
        var pos = {
            'pos_session': {
                'id': 1
            },
            'db': {
                'save_unpaid_order': function () {}
            },
            'currency': {
                'rounding': 0.01
            },
            'company': {
                'tax_calculation_rounding_method': ""
            },
            'taxes_by_id': [
                {},
                {'amount': 21}, // type A
                {'amount': 12}, // type B
                {'amount':  6}, // type C
                {'amount':  0}  // type D
            ]
        };

        pos.taxes = _.map(pos.taxes_by_id, function (tax, id) {
            return {'id': id, 'amount': tax.amount};
        });

        return pos;
    }

    function mock_product(name, price, quantity, tax_id) {
        var product = {
            'display_name': name,
            'price': price,
            'list_price': price,
            'taxes_id': [tax_id]
        };

        return product;
    }

    function mock_order_line(models) {
        var attrs = {};
        var options = {
            'product': mock_product("name", 1, 1, 1),
            'pos': mock_pos()
        };

        var mock_order_line = new models.Orderline(attrs, options);

        return mock_order_line;
    }

    function mock_order(models) {
        var mock_order = new models.Order({}, {
            'pos': mock_pos()
        });

        return mock_order;
    }

    function add_order_line(order, name, price, quantity, tax_id) {
        var product = mock_product(name, price, quantity, tax_id);
        var options = {
            'quantity': quantity
        };

        order.add_product(product, options);
    }

    // allowed range of DATA is
    // 0x20 <= byte <= 0x7E
    function test_data_range(data) {
        // todo
    }

    test('hash and sign data replace', function (assert, models) {
        var order_line = mock_order_line(models);

        assert.strictEqual(order_line._replace_hash_and_sign_chars(""), "");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("ABC"), "ABC");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("0123456789"), "0123456789");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("2.2"), "2.2");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("abcdef  ghijkl"), "ABCDEF  GHIJKL");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("AaA"), "AAA");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("ÄÅÂÁÀâäáàã"), "AAAAAAAAAA");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("Ææ"), "AEAE");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("ß"), "SS");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("çÇ"), "CC");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("ÎÏÍÌïîìí"), "IIIIIIII");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("€"), "E");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("ÊËÉÈêëéè"), "EEEEEEEE");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("ÛÜÚÙüûúù"), "UUUUUUUU");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("ÔÖÓÒöôóò"), "OOOOOOOO");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("Œœ"), "OEOE");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("ñÑ"), "NN");
        assert.strictEqual(order_line._replace_hash_and_sign_chars("ýÝÿ"), "YYY");
    });

    test('hash and sign data filter', function (assert, models) {
        var order_line = mock_order_line(models);

        assert.strictEqual(order_line._filter_allowed_hash_and_sign_chars(""), "");
        assert.strictEqual(order_line._filter_allowed_hash_and_sign_chars("ABC"), "ABC");
        assert.strictEqual(order_line._filter_allowed_hash_and_sign_chars("0123456789"), "0123456789");
        assert.strictEqual(order_line._filter_allowed_hash_and_sign_chars("abcdef"), "");
        assert.strictEqual(order_line._filter_allowed_hash_and_sign_chars("ÄÅÂÁÀâäáàãÆæßçÇÎÏÍÌïîìí€ÊËÉÈêëéèÛÜÚÙüûúùÔÖÓÒöôóòŒœñÑýÝÿ"), "");
        assert.strictEqual(order_line._filter_allowed_hash_and_sign_chars("AaA"), "AA");
        assert.strictEqual(order_line._filter_allowed_hash_and_sign_chars("A  A"), "AA");
    });

    test('_prepare_number_for_plu amount', function (assert, models) {
        var order_line = mock_order_line(models);

        assert.strictEqual(order_line._prepare_number_for_plu(0, 4), "0000");
        assert.strictEqual(order_line._prepare_number_for_plu(-0, 4), "0000");
        assert.strictEqual(order_line._prepare_number_for_plu(1, 4), "0001");
        assert.strictEqual(order_line._prepare_number_for_plu(1234, 4), "1234");
        assert.strictEqual(order_line._prepare_number_for_plu(-1234, 4), "1234");
        assert.strictEqual(order_line._prepare_number_for_plu(123456, 4), "3456");
        assert.strictEqual(order_line._prepare_number_for_plu(-123456, 4), "3456");
        assert.strictEqual(order_line._prepare_number_for_plu(0.527, 4), "0527");
        assert.strictEqual(order_line._prepare_number_for_plu(3.14159265359, 4), "5359");
        assert.strictEqual(order_line._prepare_number_for_plu(-3.14159265359, 4), "5359");
        assert.strictEqual(order_line._prepare_number_for_plu(0.12, 4), "0012");
        assert.strictEqual(order_line._prepare_number_for_plu(-0.12, 4), "0012");
    });

    test('_prepare_number_for_plu price', function (assert, models) {
        var order_line = mock_order_line(models);

        assert.strictEqual(order_line._prepare_number_for_plu(0, 8), "00000000");
        assert.strictEqual(order_line._prepare_number_for_plu(-0, 8), "00000000");
        assert.strictEqual(order_line._prepare_number_for_plu(1, 8), "00000001");
        assert.strictEqual(order_line._prepare_number_for_plu(-1, 8), "00000001");
        assert.strictEqual(order_line._prepare_number_for_plu(0.01, 8), "00000001");
        assert.strictEqual(order_line._prepare_number_for_plu(-0.01, 8), "00000001");
        assert.strictEqual(order_line._prepare_number_for_plu(1234, 8), "00001234");
        assert.strictEqual(order_line._prepare_number_for_plu(-1234, 8), "00001234");
        assert.strictEqual(order_line._prepare_number_for_plu(1234.123, 8), "01234123");
        assert.strictEqual(order_line._prepare_number_for_plu(-1234.123, 8), "01234123");
        assert.strictEqual(order_line._prepare_number_for_plu(10000, 8), "00010000");
        assert.strictEqual(order_line._prepare_number_for_plu(-10000, 8), "00010000");
    });

    test('_prepare_description_for_plu', function(assert, models) {
        var order_line = mock_order_line(models);

        assert.strictEqual(order_line._prepare_description_for_plu(""), "                    ");
        assert.strictEqual(order_line._prepare_description_for_plu("a"), "A                   ");
        assert.strictEqual(order_line._prepare_description_for_plu("     "), "                    ");
        assert.strictEqual(order_line._prepare_description_for_plu("product name"), "PRODUCTNAME         ");
        assert.strictEqual(order_line._prepare_description_for_plu("this is longer than the allowed 20 characters"), "THISISLONGERTHANTHEA");
    });

    test('hash orders', function (assert, models) {
        var order = mock_order(models);

        assert.strictEqual(order._string_to_hash(), "", "_string_to_hash of empty order");
        assert.strictEqual(order.calculate_hash(), "da39a3ee5e6b4b0d3255bfef95601890afd80709", "calculate_hash of empty order");

        add_order_line(order, "Soda LIGHT 33 CL.", 2.20, 3, 1);
        add_order_line(order, "Spaghetti Bolognaise (KLEIN)", 5.00, 2, 2);
        add_order_line(order, "Salad Bar (kg)", 16.186, 0.527, 2);
        add_order_line(order, "Steak Haché", 14.50, 1, 2);
        add_order_line(order, "Koffie verkeerd medium", 3.00, 2, 1);
        add_order_line(order, "Dame Blanche", 7.00, 1, 2);
        add_order_line(order, "Soda LIGHT 33 CL.", -2.20, -1, 1);
        // add_order_line(order, "Huiswijn (liter)", 10.00, 1.25, 1);
        add_order_line(order, "Huiswijn (liter)", 10.00, 1250, 1); // todo jov: we need to always use milliliter as a unit

        assert.strictEqual(order._string_to_hash(),
"0003SODALIGHT33CL       00000660A\
0002SPAGHETTIBOLOGNAISEK00001000B\
0527SALADBARKG          00000853B\
0001STEAKHACHE          00001450B\
0002KOFFIEVERKEERDMEDIUM00000600A\
0001DAMEBLANCHE         00000700B\
0001SODALIGHT33CL       00000220A\
1250HUISWIJNLITER       00001250A", "_string_to_hash of example 1");
        assert.strictEqual(order.calculate_hash(), "bd532992502a62c40a741ec76423198d88d5a4f3", "calculate_hash of example 1");
    });
});
