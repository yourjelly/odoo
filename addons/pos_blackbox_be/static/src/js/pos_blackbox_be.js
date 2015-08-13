odoo.define('pos_blackbox_be.pos_blackbox_be', function (require) {
    var core    = require('web.core');
    var screens = require('point_of_sale.screens');
    var models = require('point_of_sale.models');
    var devices = require('point_of_sale.devices');
    var chrome = require('point_of_sale.chrome');
    var Class = require('web.Class');
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

            var replaced_char_array = _.map(str, function (char, index, str) {
                var translation = translation_table[char];
                if (translation) {
                    return translation;
                } else {
                    return char;
                }
            });

            return replaced_char_array.join("");
        },

        // for hash and sign the allowed range for DATA is:
        //   - A-Z
        //   - 0-9
        // and SPACE as well. We filter SPACE out here though, because
        // SPACE will only be used in DATA of hash and sign as description
        // padding
        _filter_allowed_hash_and_sign_chars: function(str) {
            if (typeof str !== 'string') {
                throw "Can only handle strings";
            }

            var filtered_char_array = _.filter(str, function (char) {
                var ascii_code = char.charCodeAt(0);

                if ((ascii_code >= "A".charCodeAt(0) && ascii_code <= "Z".charCodeAt(0)) ||
                    (ascii_code >= "0".charCodeAt(0) && ascii_code <= "9".charCodeAt(0))) {
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

        // for both amount and price
        // price should be in eurocents
        // amount should be in gram
        _prepare_number_for_plu: function(number, field_length) {
            number = Math.abs(number);
            number = Math.round(number); // todo jov: don't like this

            var number_string = number.toFixed(0);

            number_string = this._replace_hash_and_sign_chars(number_string);
            number_string = this._filter_allowed_hash_and_sign_chars(number_string);

            // get the required amount of least significant characters
            number_string = number_string.substr(-field_length);

            // pad left with 0 to required size
            while (number_string.length < field_length) {
                number_string = "0" + number_string;
            }

            return number_string;
        },

        _prepare_description_for_plu: function(description) {
            description = this._replace_hash_and_sign_chars(description);
            description = this._filter_allowed_hash_and_sign_chars(description);

            // get the 20 most significant characters
            description = description.substr(0, 20);

            // pad right with SPACE to required size of 20
            while (description.length < 20) {
                description = description + " ";
            }

            return description;
        },

        _get_amount_for_plu: function () {
            // three options:
            // 1. unit => need integer
            // 2. weight => need integer gram
            // 3. volume => need integer milliliter

            var amount = this.get_quantity();
            var uom = this.get_unit();

            if (uom.is_unit) {
                return amount;
            } else {
                if (uom.category_id[1] === "Weight") {
                    var uom_gram = _.find(this.pos.units_by_id, function (unit) {
                        return unit.category_id[1] === "Weight" && unit.name === "g";
                    });
                    amount = (amount / uom.factor) * uom_gram.factor;
                } else if (uom.category_id[1] === "Volume") {
                    var uom_milliliter = _.find(this.pos.units_by_id, function (unit) {
                        return unit.category_id[1] === "Volume" && unit.name === "Milliliter(s)";
                    });
                    amount = (amount / uom.factor) * uom_milliliter.factor;
                }

                return amount;
            }
        },

        generate_plu_line: function () {
            // |--------+-------------+-------+-----|
            // | AMOUNT | DESCRIPTION | PRICE | VAT |
            // |      4 |          20 |     8 |   1 |
            // |--------+-------------+-------+-----|

            // steps:
            // 1. replace all chars
            // 2. filter out forbidden chars
            // 3. build PLU line

            var amount = this._get_amount_for_plu();
            var description = this.get_product().display_name;
            var price_in_eurocents = this.get_display_price() * 100;
            var vat_code = this._get_vat_code();

            amount = this._prepare_number_for_plu(amount, 4);
            description = this._prepare_description_for_plu(description);
            price_in_eurocents = this._prepare_number_for_plu(price_in_eurocents, 8);

            return amount + description + price_in_eurocents + vat_code;
        }
    });

    models.Order = models.Order.extend({
        _hash_and_sign_string: function() {
            var order_str = "";

            this.get_orderlines().forEach(function (current, index, array) {
                order_str += current.generate_plu_line();
            });

            return order_str;
        },

        calculate_hash: function() {
            return Sha1.hash(this._hash_and_sign_string());
        }
    });

    var FDMPacketField = Class.extend({
        init: function (name, length, content, pad_character) {
            if (typeof content !== 'string') {
                throw "Can only handle string contents";
            }

            this.name = name;
            this.length = length;

            this.content = this._pad_left_to_length(content, pad_character);
        },

        _pad_left_to_length: function (content, pad_character) {
            if (content.length < this.length && ! pad_character) {
                throw "Can't pad without a pad character";
            }

            while (content.length < this.length) {
                content = pad_character + content;
            }

            return content;
        },

        to_string: function () {
            return this.content;
        }
    });

    var FDMPacket = Class.extend({
        init: function () {
            this.fields = [];
        },

        add_field: function (field) {
            this.fields.push(field);
        },

        from_string: function (packet_string) {
            // todo jov: parse FDM responses
        },

        to_string: function () {
            return _.map(this.fields, function (field) {
                return field.to_string();
            }).join("");
        }

        // todo jov: send: function () {}?
    });

    PaymentScreenWidget.include({
        validate_order: function(force_validation) {
            var self = this;
            var payment_screen_super = this._super.bind(self);

            this.pos.proxy.request_fdm_identification().then(function (response) {
                var order = self.pos.get_order();
                // var hash = order.calculate_hash();

                // console.log(order._hash_and_sign_string());

                response = self.pos.proxy.parse_fdm_identification_response(response);

                if (response.vsc_identification_number) {
                    payment_screen_super(force_validation);
                } else {
                    self.gui.show_popup("error", {
                        'title': _t("Fiscal Data Module error"),
                        'body':  _t("Could not connect to the Fiscal Data Module."),
                    });
                }
            });
        }
    });

    devices.ProxyDevice.include({
        sequence_number: 0,

        increment_sequence_number: function () {
            this.sequence_number = (this.sequence_number + 1) % 100;
        },

        build_request: function (id) {
            var packet = new FDMPacket();

            packet.add_field(new FDMPacketField("id", 1, id));
            packet.add_field(new FDMPacketField("sequence number", 2, this.sequence_number.toString(), "0"));
            packet.add_field(new FDMPacketField("retry number", 1, "0"));
            this.increment_sequence_number();

            return packet;
        },

        parse_fdm_identification_response: function (response) {
            return {
                identifier: response[0], // 0
                sequence_number: parseInt(response.substr(1, 2), 10), // 1, 2
                retry_counter: parseInt(response[3], 10), // 3
                error_1: parseInt(response[4], 10), // 4
                error_2: parseInt(response.substr(5, 2), 10), // 5, 6
                error_3: parseInt(response.substr(7, 3), 10), // 7, 8, 9
                fdm_unique_production_number: response.substr(10, 11), // 10-20
                fdm_firmware_version_number: response.substr(21, 20), // 22-40
                fdm_communication_protocol_version: response[41], // 41
                vsc_identification_number: response.substr(42, 14), // 42-55
                vsc_version_number: parseInt(response.substr(56, 3), 10) // 56-59
            };
        },

        build_fdm_identification_request: function () {
            return this.build_request("I");
        },

        build_fdm_hash_and_sign_request: function (order) {
            var packet = this.build_request("H");

            packet.add_field(new FDMPacketField("ticket date", 8, moment().format("YYYYMMDD")));
            packet.add_field(new FDMPacketField("ticket time", 6, moment().format("HHmmss")));
            // packet.add_field(new FDMPacketField("insz or bis number", 11, "")); // todo jov
            // packet.add_field(new FDMPacketField("production number POS", 14, "")); // todo jov
            // packet.add_field(new FDMPacketField("ticket number", 6, "")); // todo jov
            // packet.add_field(new FDMPacketField("event label", 2, "")); // todo jov
            // packet.add_field(new FDMPacketField("total amount to pay in eurocent", 11, "")); // todo jov

            // packet.add_field(new FDMPacketField("tax percentage 1", 4, "")); // todo jov
            // packet.add_field(new FDMPacketField("amount at tax percentage 1 in eurocent", 11, "")); // todo jov
            // packet.add_field(new FDMPacketField("tax percentage 2", 4, "")); // todo jov
            // packet.add_field(new FDMPacketField("amount at tax percentage 2 in eurocent", 11, "")); // todo jov
            // packet.add_field(new FDMPacketField("tax percentage 3", 4, "")); // todo jov
            // packet.add_field(new FDMPacketField("amount at tax percentage 3 in eurocent", 11, "")); // todo jov
            // packet.add_field(new FDMPacketField("tax percentage 4", 4, "")); // todo jov
            // packet.add_field(new FDMPacketField("amount at tax percentage 4 in eurocent", 11, "")); // todo jov
            // packet.add_field(new FDMPacketField("PLU hash", 40, order.calculate_hash()));

            return packet;
        },

        request_fdm_identification: function () {
            var self = this;

            return this.message('request_fdm_identification', {'high_layer': self.build_fdm_identification_request().to_string()});
        }
    });

    var _posmodelproto = models.PosModel.prototype;
    models.PosModel = models.PosModel.extend({
        initialize: function (session, attributes) {
            var user_model = _.find(this.models, function (model) {
                return model.model === "res.users" && _.find(model.fields, function (field) {
                    return field === "pos_security_pin";
                });
            });

            user_model.fields.push("insz_or_bis_number");
            _posmodelproto.initialize.apply(this, arguments);
        }
    });

    chrome.DebugWidget.include({
        start: function () {
            var self = this;
            this._super();

            this.$('.button.request-fdm-identification').click(function () {
                console.log(self.pos.proxy.build_fdm_hash_and_sign_request());

                console.log("Sending identification request to controller...");

                self.pos.proxy.request_fdm_identification().then(function (response) {
                    console.log(response);
                    console.log(self.pos.proxy.parse_fdm_identification_response(response));
                });
            });
        }
    });

    return {
        'FDMPacketField': FDMPacketField,
        'FDMPacket': FDMPacket
    };
});
