odoo.define('pos_blackbox_be.pos_blackbox_be', function (require) {
    var core    = require('web.core');
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');
    var PaymentScreenWidget = screens.PaymentScreenWidget;

    var _t      = core._t;

    models.Orderline = models.Orderline.extend({
        // generates a table of the form
        // {..., 'char_to_translate': translation_of_char, ...}
        _generate_translation_table: function() {
            var replacements = [
                ["ÄÅÂÁÀâäáàã", "A"],
                ["Ææ", "AE"],
                ["ß", "SS"],
                ["çÇ", "C"],
                ["ÎÏÍÌïîìí", "I"],
                ["€", "E"],
                ["ÊËÉÈêëéè", "E"],
                ["ÛÜÚÙüûúù", "U"],
                ["ÔÖÓÒöôóò", "O"],
                ["Œœ", "OE"],
                ["ñÑ", "N"],
                ["ýÝÿ", "Y"]
            ];

            var lowercase_to_uppercase = _.range("a".charCodeAt(0), "z".charCodeAt(0) + 1).map(function(lowercase_ascii_code) {
                return [String.fromCharCode(lowercase_ascii_code), String.fromCharCode(lowercase_ascii_code).toUpperCase()];
            });
            replacements = replacements.concat(lowercase_to_uppercase);

            var lookup_table = {};

            _.forEach(replacements, function(letter_group) {
                _.forEach(letter_group[0], function(special_char) {
                    lookup_table[special_char] = letter_group[1];
                });
            });

            return lookup_table;
        },

        _replace_hash_and_sign_chars: function(str) {
            if (typeof str !== 'string') {
                throw "Can only handle strings";
            }

            var translation_table = this._generate_translation_table();

            var replace_char_array = _.map(str, function (char, index, str) {
                var translation = translation_table[char];
                if (translation) {
                    return translation;
                } else {
                    return char;
                }
            });

            return replace_char_array.join("");
        },

        // for hash and sign the allowed range for DATA is:
        //   - A-Z
        //   - 0-9
        //   - SPACE
        _filter_allowed_hash_and_sign_chars: function(str) {
            if (typeof str !== 'string') {
                throw "Can only handle strings";
            }

            var filtered_char_array = _.filter(str, function (char) {
                var ascii_code = char.charCodeAt(0);

                if ((ascii_code >= "A".charCodeAt(0) && ascii_code <= "Z".charCodeAt(0)) ||
                    (ascii_code >= "0".charCodeAt(0) && ascii_code <= "9".charCodeAt(0)) ||
                    (ascii_code === " ".charCodeAt(0))) {
                    return true;
                } else {
                    return false;
                }
            });

            return filtered_char_array.join("");
        },

        _get_vat_code: function() {
            var tax = this.get_taxes()[0]; // todo jov: multiple taxes

            // todo jov: put this stuff on account.tax
            if (tax.amount === 21) {
                return "A";
            } else if (tax.amount === 12) {
                return "B";
            } else if (tax.amount === 8) {
                return "C";
            } else if (tax.amount === 0) {
                return "D";
            }

            throw "Tax amount " + tax.amount + " doesn't have a VAT code.";
        },

        _prepare_number_for_plu: function(number) {
            number = Math.abs(number);
            return number.toString();
        },

        _prepare_amount_for_plu: function(amount) {
            amount = this._prepare_number_for_plu(amount);
            amount = this._replace_hash_and_sign_chars(amount);
            amount = this._filter_allowed_hash_and_sign_chars(amount);

            // get the 4 least significant characters
            amount = amount.substr(-4);

            // pad left with 0 to required size of 4
            while (amount.length < 4) {
                amount = "0" + amount;
            }

            return amount;
        },

        _prepare_description_for_plu: function(description) {

        },

        generate_plu_line: function () {
            // |--------+-------------+-------+-----|
            // | AMOUNT | DESCRIPTION | PRICE | VAT |
            // |      4 |          20 |     8 |   1 |
            // |--------+-------------+-------+-----|

            // fields we need:
            // - amount => get_quantity()
            // - description => display_name
            // - price => get_price_with_tax()
            // - vat => could hardcode table, or add the code to taxes

            // steps:
            // 1. replace all chars
            // 2. filter out forbidden chars
            // 3. build PLU line

            var amount = this.get_quantity(); // (todo jov: need grams and milliliters)
            var description = this.get_product().display_name;
            var price = this.get_product().list_price; // todo jov: get_price_with_tax()?
            var vat_code = this._get_vat_code();

            price = this._prepare_number_for_plu(price);

            description = this._replace_hash_and_sign_chars(description);
            price = this._replace_hash_and_sign_chars(price);
            vat_code = this._replace_hash_and_sign_chars(vat_code);

            description = this._filter_allowed_hash_and_sign_chars(description);
            price = this._filter_allowed_hash_and_sign_chars(price);
            vat_code = this._filter_allowed_hash_and_sign_chars(vat_code);

            return amount + description + price + vat_code;
        }
    });

    models.Order = models.Order.extend({
        _string_to_hash: function() {
            var order_str = "";

            this.get_orderlines().forEach(function (current, index, array) {
                order_str += current.generate_plu_line();
            });

            return order_str;
        },

        calculate_hash: function() {
            return Sha1.hash(this._string_to_hash());
        }
    });

    PaymentScreenWidget.include({
        validate_order: function(force_validation) {
            // todo jov: talk to blackbox

            this._super();
        }
    });
});
