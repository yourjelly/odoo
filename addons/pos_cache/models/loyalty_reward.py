from odoo import models, fields


class LoyaltyReward(models.Model):
    _inherit = 'loyalty.reward'

    cache_discount_product_ids = fields.Char(compute='_compute_cache_discount_product_ids')

    def _compute_cache_discount_product_ids(self):
        """ Will be used instead of the domain to link the discount and the products as it is a lot faster.
        This field shouldn't be added in any view, and thus it will benefit the PoS without impacting the performances elsewhere.
        """
        compute_all_discount_product = self.env['ir.config_parameter'].sudo().get_param('loyalty.compute_all_discount_product_ids', 'enabled')
        if compute_all_discount_product != 'enabled':
            for reward in self:
                # The order does not matter, and ordering is slow. By forcing id it is quite a lot faster.
                # (We cannot completely remove the order)
                product_ids = self.env['product.product'].search_read(reward._get_discount_product_domain(), ['id'], order='id')
                if product_ids:
                    reward.cache_discount_product_ids = str([product_id['id'] for product_id in product_ids])
                else:
                    reward.cache_discount_product_ids = ''
