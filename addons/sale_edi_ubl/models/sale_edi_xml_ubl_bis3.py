from odoo import models, Command


class SaleEdiXmlUBLBIS3(models.AbstractModel):
    _name = "sale.edi.xml.ubl_bis3"
    _inherit = "sale.edi.common"
    _description = "UBL BIS Ordering 3.0"

    def _find_value(self, xpath, tree, nsmap=False):
        return self.env['account.edi.xml.ubl_bis3']._find_value(xpath, tree, nsmap)

    # -------------------------------------------------------------------------
    # Import order
    # -------------------------------------------------------------------------

    def _import_fill_order(self, order, tree):
        """ Fill order details by extracting details from xml tree.

        param order: Order to fill details from xml tree.
        param tree: Xml tree to extract details.
        :return: list of logs to add warnig and information about data from xml.
        """
        logs = []
        order_values = {}
        partner, partner_logs = self._import_partner(
            order.company_id,
            **self._import_retrieve_partner_vals(tree, "BuyerCustomer"),
        )
        if partner:
            order_values['partner_id'] = partner.id
        delivery_partner, delivery_partner_logs = self._import_delivery_partner(
            order,
            **self._import_retrieve_delivery_vals(tree),
        )
        if delivery_partner:
            order_values['partner_shipping_id'] = delivery_partner.id
        order_values['currency_id'], currency_logs = self._import_currency(tree, './/{*}DocumentCurrencyCode')

        order_values['date_order'] = tree.findtext('./{*}IssueDate')
        order_values['client_order_ref'] = tree.findtext('./{*}ID')
        order_values['note'] = self._import_description(tree, xpaths=['./{*}Note'])
        order_values['origin'] = tree.findtext('./{*}OriginatorDocumentReference/{*}ID')
        order_values['payment_term_id'] = self._import_payment_term_id(order, tree, './/cac:PaymentTerms/cbc:Note')

        allowance_charges_line_vals, allowance_charges_logs = self._import_document_allowance_charges(tree, order.company_id, 'sale')
        lines_vals, line_logs = self._import_order_lines(order, tree, './{*}OrderLine/{*}LineItem')
        lines_vals += allowance_charges_line_vals

        order_values = {
            **order_values,
            'order_line': [Command.create(line_vals) for line_vals in lines_vals],
        }
        order.write(order_values)
        logs += partner_logs + delivery_partner_logs + currency_logs + line_logs + allowance_charges_logs

        return logs

    def _import_retrieve_partner_vals(self, tree, role):
        return self.env['account.edi.xml.ubl_bis3']._import_retrieve_partner_vals(tree, role)

    def _import_retrieve_delivery_vals(self, tree):
        """ Returns a dict of values that will be used to retrieve the delivery address. """
        return {
            'phone': self._find_value('.//cac:Delivery/cac:DeliveryParty//cbc:Telephone', tree),
            'email': self._find_value('.//cac:Delivery/cac:DeliveryParty//cbc:ElectronicMail', tree),
            'name': self._find_value('.//cac:Delivery/cac:DeliveryParty//cbc:Name', tree),
        }

    def _get_tax_nodes(self, tree):
        return self.env['account.edi.xml.ubl_bis3']._get_tax_nodes(tree)

    def _get_document_allowance_charge_xpaths(self):
        return self.env['account.edi.xml.ubl_bis3']._get_document_allowance_charge_xpaths()

    def _get_line_xpaths(self, line=None, qty_factor=1):
        return {
            **self.env['account.edi.xml.ubl_bis3']._get_line_xpaths(),
            'delivered_qty': ('./{*}Quantity'),
        }
