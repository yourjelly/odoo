from odoo.addons.account.tests.common import AccountTestInvoicingCommon
from odoo.tools.float_utils import float_is_zero

JO_MAX_DP = 9


class JoEdiCommon(AccountTestInvoicingCommon):

    def equal_to_jo_max_dp(self, vals):
        first_tuple = None
        error_message = ""
        for label, value in vals.items():
            if not first_tuple:
                first_tuple = (label, value)
            else:
                if not float_is_zero(value - first_tuple[1], JO_MAX_DP):
                    error_message += f"{label} ({value}) != {first_tuple[0]} ({first_tuple[1]})\n"
        return error_message

    def extract_vals_from_subtotals(self, subtotals, defaults):
        for subtotal in subtotals:
            is_general_tax = 'Percent' in subtotal[2][1].tag
            if is_general_tax:
                defaults.update({
                    'taxable_amount_general': float(subtotal[0].text),
                    'tax_amount_general_subtotal': float(subtotal[1].text),
                    'tax_percent': float(subtotal[2][1].text) / 100,
                })
                defaults['total_tax_amount'] += defaults['tax_amount_general_subtotal']
            else:
                defaults.update({
                    'taxable_amount_special': float(subtotal[0].text),
                    'tax_amount_special': float(subtotal[1].text),
                })
                defaults['total_tax_amount'] += defaults['tax_amount_special']
        return defaults

    def validate_jo_edi_numbers(self, xml_string):
        root = self.get_xml_tree_from_string(xml_string)
        error_message = ""

        total_discount = 0
        total_tax = 0
        tax_exclusive_amount = 0
        tax_inclusive_amount = 0

        lines = []
        for child in root:
            if 'AllowanceCharge' in child.tag:
                total_discount = float(child[2].text)
            if 'TaxTotal' in child.tag:
                total_tax = float(child[0].text)
            if 'LegalMonetaryTotal' in child.tag:
                tax_exclusive_amount = float(child[0].text)
                tax_inclusive_amount = float(child[1].text)
                monetary_values_discount = float(child[2].text)
                payable_amount = float(child[-1].text)
                if monetary_values_discount != total_discount:  # They have to be exactly the same, no decimal difference is tolerated
                    error_message += f"Monetary Values discount ({monetary_values_discount}) != Total Discount ({total_discount})\n"
                if payable_amount != tax_inclusive_amount:  # They have to be exactly the same, no decimal difference is tolerated
                    error_message += f"Payable Amount ({payable_amount}) != Tax Inclusive Amount ({tax_inclusive_amount})\n"
            if 'InvoiceLine' in child.tag:
                line = {
                    'id': child[0].text,
                    'quantity': float(child[1].text),
                    'line_extension_amount': float(child[2].text),
                    'tax_amount_general': float(child[3][0].text) if 'TaxTotal' in child[3].tag else 0,
                    'rounding_amount': float(child[3][1].text) if 'TaxTotal' in child[3].tag else float(child[2].text),  # defaults to line_extension_amount in the absence of taxes
                    **self.extract_vals_from_subtotals(
                        subtotals=filter(lambda x: 'TaxSubtotal' in x.tag, child[3]),
                        defaults={
                            'taxable_amount_general': float(child[2].text),  # line_extension_amount
                            'tax_amount_general_subtotal': 0,
                            'tax_percent': 0,
                            'taxable_amount_special': float(child[2].text),  # line_extension_amount
                            'tax_amount_special': 0,
                            'total_tax_amount': 0,
                        }),
                    'price_unit': float(child[-1][0].text),
                    'discount': float(child[-1][1][2].text),
                }
                lines.append(line)
                line_errors = self.equal_to_jo_max_dp({
                    # taxable_amount = line_extension_amount = price_unit * quantity - discount
                    'taxable_amount_general': line['taxable_amount_general'],
                    'taxable_amount_special': line['taxable_amount_special'],
                    'line_extension_amount': line['line_extension_amount'],
                    'price_unit * quantity - discount': line['price_unit'] * line['quantity'] - line['discount'],
                }) + self.equal_to_jo_max_dp({
                    # rounding_amount = line_extension_amount + total_tax_amount
                    'rounding_amount': line['rounding_amount'],
                    'line_extension_amount + total_tax_amount': line['line_extension_amount'] + line['total_tax_amount'],
                }) + self.equal_to_jo_max_dp({
                    'tax_amount_general': line['tax_amount_general'],
                    'tax_amount_general_subtotal': line['tax_amount_general_subtotal'],
                    'taxable_amount * tax_percent': (line['taxable_amount_general'] + line['tax_amount_special']) * line['tax_percent'],
                })
                if line_errors:
                    error_message += f"Errors on the line {line['id']}\n"
                    error_message += line_errors
                    error_message += "-------------------------------------------------------------------------\n"

        aggregated_tax_exclusive_amount = sum(line['price_unit'] * line['quantity'] for line in lines)
        aggregated_tax_inclusive_amount = sum(line['price_unit'] * line['quantity'] - line['discount'] + line['total_tax_amount'] for line in lines)
        aggregated_tax_amount = sum(line['tax_amount_general'] for line in lines)
        aggregated_discount_amount = sum(line['discount'] for line in lines)

        error_message += self.equal_to_jo_max_dp({
            'tax_exclusive_amount': tax_exclusive_amount,
            'aggregated_tax_exclusive_amount': aggregated_tax_exclusive_amount,
        }) + self.equal_to_jo_max_dp({
            'tax_inclusive_amount': tax_inclusive_amount,
            'aggregated_tax_inclusive_amount': aggregated_tax_inclusive_amount,
            'tax_exclusive_amount - total_discount + total_tax': tax_exclusive_amount - total_discount + sum(line['total_tax_amount'] for line in lines),
        }) + self.equal_to_jo_max_dp({
            'tax_amount': total_tax,
            'aggregated_tax_amount': aggregated_tax_amount,
        }) + self.equal_to_jo_max_dp({
            'discount_amount': total_discount,
            'aggregated_discount_amount': aggregated_discount_amount,
        })

        return error_message
