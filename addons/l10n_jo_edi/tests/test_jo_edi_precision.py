from odoo.tests import tagged
from odoo.tools.float_utils import float_is_zero
from odoo.addons.l10n_jo_edi.tests.jo_edi_common import JoEdiCommon

JO_MAX_DP = 9


@tagged('post_install_l10n', 'post_install', '-at_install')
class TestJoEdiPrecision(JoEdiCommon):
    def _equality_check(self, vals_dict, up_to_jo_max_dp=True):
        def equal_strict(val1, val2):
            return val1 == val2

        def equal_jo_max_dp(val1, val2):
            return float_is_zero(val1 - val2, JO_MAX_DP)

        equals = equal_jo_max_dp if up_to_jo_max_dp else equal_strict
        first_tuple = None
        error_message = ""
        for label, value in vals_dict.items():
            if not first_tuple:
                first_tuple = (label, value)
            else:
                if not equals(value, first_tuple[1]):
                    error_message += f"{label} ({value}) != {first_tuple[0]} ({first_tuple[1]})\n"
        return error_message

    def _extract_vals_from_subtotals(self, subtotals, defaults):
        for subtotal in subtotals:
            tax_percent = float(subtotal.findtext('{*}TaxCategory/{*}Percent', default=-1))
            if tax_percent == -1:  # special (fixed amount) tax
                defaults.update({
                    'taxable_amount_special': float(subtotal.findtext('{*}TaxableAmount')),
                    'tax_amount_special': float(subtotal.findtext('{*}TaxAmount')),
                })
                defaults['total_tax_amount'] += defaults['tax_amount_special']
            else:
                defaults.update({
                    'taxable_amount_general': float(subtotal.findtext('{*}TaxableAmount')),
                    'tax_amount_general_subtotal': float(subtotal.findtext('{*}TaxAmount')),
                    'tax_percent': tax_percent / 100,
                })
                defaults['total_tax_amount'] += defaults['tax_amount_general_subtotal']

        return defaults

    def validate_jo_edi_numbers(self, xml_string):
        root = self.get_xml_tree_from_string(xml_string)
        error_message = ""

        total_discount = float(root.findtext('./{*}AllowanceCharge/{*}Amount'))
        total_tax = float(root.findtext('./{*}TaxTotal/{*}TaxAmount', default=0))

        tax_exclusive_amount = float(root.findtext('./{*}LegalMonetaryTotal/{*}TaxExclusiveAmount'))
        tax_inclusive_amount = float(root.findtext('./{*}LegalMonetaryTotal/{*}TaxInclusiveAmount'))
        monetary_values_discount = float(root.findtext('./{*}LegalMonetaryTotal/{*}AllowanceTotalAmount'))
        payable_amount = float(root.findtext('./{*}LegalMonetaryTotal/{*}PayableAmount'))

        error_message += self._equality_check({  # They have to be exactly the same, no decimal difference is tolerated
            'Monetary Values discount': monetary_values_discount,
            'Total Discount': total_discount,
        }, up_to_jo_max_dp=False)
        error_message += self._equality_check({  # They have to be exactly the same, no decimal difference is tolerated
            'Payable Amount': payable_amount,
            'Tax Inclusive Amount': tax_inclusive_amount,
        }, up_to_jo_max_dp=False)

        lines = []
        for xml_line in root.findall('./{*}InvoiceLine'):
            line_extension_amount = float(xml_line.findtext('{*}LineExtensionAmount'))
            line = {
                'id': xml_line.findtext('{*}ID'),
                'quantity': float(xml_line.findtext('{*}InvoicedQuantity')),
                'line_extension_amount': line_extension_amount,
                'tax_amount_general': float(xml_line.findtext('{*}TaxTotal/{*}TaxAmount', default=0)),
                'rounding_amount': float(xml_line.findtext('{*}TaxTotal/{*}RoundingAmount', default=line_extension_amount)),  # defaults to line_extension_amount in the absence of taxes
                **self._extract_vals_from_subtotals(
                    subtotals=xml_line.findall('{*}TaxTotal/{*}TaxSubtotal'),
                    defaults={
                        'taxable_amount_general': line_extension_amount,
                        'tax_amount_general_subtotal': 0,
                        'tax_percent': 0,
                        'taxable_amount_special': line_extension_amount,
                        'tax_amount_special': 0,
                        'total_tax_amount': 0,
                    }),
                'price_unit': float(xml_line.findtext('{*}Price/{*}PriceAmount')),
                'discount': float(xml_line.findtext('{*}Price/{*}AllowanceCharge/{*}Amount')),
            }
            lines.append(line)
            line_errors = self._equality_check({
                # taxable_amount = line_extension_amount = price_unit * quantity - discount
                'General Taxable Amount': line['taxable_amount_general'],
                'Special Taxable Amount': line['taxable_amount_special'],
                'Line Extension Amount': line['line_extension_amount'],
                'Price Unit * Quantity - Discount': line['price_unit'] * line['quantity'] - line['discount'],
            }) + self._equality_check({
                # rounding_amount = line_extension_amount + total_tax_amount
                'Rounding Amount': line['rounding_amount'],
                'Line Extension Amount + Total Tax': line['line_extension_amount'] + line['total_tax_amount'],
            }) + self._equality_check({
                'General Tax Amount': line['tax_amount_general'],
                'General Tax Amount in subtotal': line['tax_amount_general_subtotal'],
                'Taxable Amount * Tax Percent': (line['taxable_amount_general'] + line['tax_amount_special']) * line['tax_percent'],
            })
            if line_errors:
                error_message += f"Errors on the line {line['id']}\n"
                error_message += line_errors
                error_message += "-------------------------------------------------------------------------\n"

        aggregated_tax_exclusive_amount = sum(line['price_unit'] * line['quantity'] for line in lines)
        aggregated_tax_inclusive_amount = sum(line['price_unit'] * line['quantity'] - line['discount'] + line['total_tax_amount'] for line in lines)
        aggregated_tax_amount = sum(line['tax_amount_general'] for line in lines)
        aggregated_discount_amount = sum(line['discount'] for line in lines)

        error_message += self._equality_check({
            'Tax Exclusive Amount': tax_exclusive_amount,
            'Aggregated Tax Exclusive Amount': aggregated_tax_exclusive_amount,
        }) + self._equality_check({
            'Tax Inclusive Amount': tax_inclusive_amount,
            'Aggregated Tax Inclusive Amount': aggregated_tax_inclusive_amount,
            'Tax Exclusive Amount - Total Discount + Total Tax': tax_exclusive_amount - total_discount + sum(line['total_tax_amount'] for line in lines),
        }) + self._equality_check({
            'Tax Amount': total_tax,
            'Aggregated Tax Amount': aggregated_tax_amount,
        }) + self._equality_check({
            'Discount Amount': total_discount,
            'Aggregated Discount Amount': aggregated_discount_amount,
        })

        return error_message

    def test_jo_sales_invoice_precision(self):
        eur = self.env.ref('base.EUR')
        self.setup_currency_rate(eur, 1.41)
        self.company.l10n_jo_edi_taxpayer_type = 'sales'
        self.company.l10n_jo_edi_sequence_income_source = '16683693'

        invoice_values = {
            'name': 'TestEIN022',
            'currency': self.usd,
            'date': '2023-11-12',
            'lines': [
                {
                    'product_id': self.product_a,
                    'quantity': 3.48,
                    'price': 1.56,
                    'discount_percent': 2.5,
                    'tax_ids': [self.jo_general_tax_16_included],
                },
                {
                    'product_id': self.product_b,
                    'quantity': 6.02,
                    'price': 2.79,
                    'discount_percent': 2.5,
                    'tax_ids': [self.jo_general_tax_16_included],
                },
            ],
        }
        invoice = self._create_invoice(invoice_values)

        generated_file = self.env['account.edi.xml.ubl_21.jo']._export_invoice(invoice)
        errors = self.validate_jo_edi_numbers(generated_file)
        self.assertFalse(errors, errors)
