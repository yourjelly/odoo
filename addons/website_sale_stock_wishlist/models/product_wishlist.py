# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
from odoo import fields, models, _

class ProductWishlist(models.Model):
    _inherit = "product.wishlist"

    stock_notification = fields.Boolean(default=False, required=True)

    def _add_to_wishlist(self, pricelist_id, currency_id, website_id, price, product_id, partner_id=False):
        wish = super()._add_to_wishlist(
            pricelist_id=pricelist_id,
            currency_id=currency_id,
            website_id=website_id,
            price=price,
            product_id=product_id,
            partner_id=partner_id,
        )
        wish['stock_notification'] = wish.product_id.product_tmpl_id._is_sold_out()

        return wish

    def _send_availability_email(self):
        for wishlist in self.env['product.wishlist'].search([('stock_notification', '=', True)]):
            product = wishlist.with_context(website_id=wishlist.website_id.id).product_id
            if not product.product_tmpl_id._is_sold_out():
                body_html = self.env.ref(
                    "website_sale_stock_wishlist.availability_email_body"
                )._render(
                    {
                        "wishlist": wishlist,
                    }
                )

                full_mail = self.env["mail.render.mixin"]._render_encapsulate(
                    "mail.mail_notification_light",
                    body_html,
                    add_context={
                        "message": self.env["mail.message"]
                        .sudo()
                        .new(dict(body=body_html, record_name=product.name)),
                        "model_description": _("Wishlist"),
                    },
                )

                mail_values = {
                    "subject": "%s available" % (product.name),
                    "email_from": product.company_id.partner_id.email_formatted
                    if product.company_id
                    else self.env.user.email_formatted,
                    "email_to": wishlist.partner_id.email_formatted,
                    "body_html": full_mail,
                }

                mail = self.env["mail.mail"].sudo().create(mail_values)
                mail.send(raise_exception=False)

                wishlist.stock_notification = False
