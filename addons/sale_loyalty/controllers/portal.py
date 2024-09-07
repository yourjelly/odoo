from odoo.addons.sale.controllers.portal import CustomerPortal as portal


class CustomerPortal(portal):

    def _get_order_page_values(self, order_sudo, message=False):
        values = super()._get_order_page_values(order_sudo, message)
        values['loyalty_data'] = order_sudo.state == 'sale' and order_sudo.loyalty_data

        return values
