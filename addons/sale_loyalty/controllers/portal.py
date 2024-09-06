from odoo.addons.sale.controllers.portal import CustomerPortal as portal


class CustomerPortal(portal):

    def _get_order_page_values(self, order_sudo, message=False):
        values = super()._get_order_page_values(order_sudo, message)
        if 'loyalty_card' in order_sudo.loyalty_total:
            values.update({
               'loyalty_card': order_sudo.loyalty_total['loyalty_card'],
                'point_name': order_sudo.loyalty_total['point_name'],
            })

        return values
