from lxml import html

from odoo import fields, models

class CardCampaignTemplate(models.Model):
    _inherit = 'card.template'

    template_variant = fields.Selection(selection_add=[('test_1', 'Test Variant 1')], ondelete={'test_1': 'cascade'})

    def _get_variant_parts(self):
        if self.template_variant == 'test_1':
            return {
                'body': html.fromstring("""
<div>
    <p id="header" odoo-set-text="header" odoo-set-text-color="header"></p>
    <p id="subheader" odoo-set-text="subheader" odoo-set-text-color="subheader"></p>
    <p id="section_1" odoo-set-text="section_1" odoo-set-text-color="section_1"></p>
    <p id="subsection_1" odoo-set-text="subsection_1" odoo-set-text-color="subsection_1"></p>
    <p id="subsection_2" odoo-set-text="subsection_2" odoo-set-text-color="subsection_2"></p>
    <p id="subsection_3" odoo-set-text="button" odoo-set-text-color="button"></p>
    <p id="button" odoo-set-text="button" odoo-set-text-color="button"></p>
    <img id="image_1" odoo-set-src="image_1"></p>
    <img id="image_2" odoo-set-src="image_2"></p>
</div>
                """),
                'style': """
<style>
    p { margin: 1px };
    body { width: 100%; height: 100%; };
</style>
                """,
            }
        return super()._get_variant_parts()
