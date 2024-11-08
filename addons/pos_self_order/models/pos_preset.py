from odoo import models, api


class PosPreset(models.Model):
    _inherit = ["pos.preset"]

    # will be overridden.
    @api.model
    def _load_pos_self_data_domain(self, data):
        preset_ids = []
        if data['pos.config']['data'][0]['self_ordering_takeaway']:
            preset_ids += [
                data['pos.config']['data'][0]['self_ordering_takeaway_preset_in'],
                data['pos.config']['data'][0]['self_ordering_takeaway_preset_out']]
        else:
            preset_ids.append(data['pos.config']['data'][0]['default_preset_id'])

        return [('id', 'in', preset_ids)]

    @api.model
    def _load_pos_self_data_fields(self, config_id):
        return ['name', 'pricelist_id', 'fiscal_position_id']
