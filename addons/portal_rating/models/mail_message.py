# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models
from odoo.tools import format_datetime


class MailMessage(models.Model):
    _inherit = 'mail.message'

    def _portal_get_default_format_properties_names(self, options=None):
        """ Add request for rating information

        :param dict options: supports 'rating_include' option allowing to
          conditionally include rating information;
        """
        properties_names = super()._portal_get_default_format_properties_names()
        if options and options.get('rating_include'):
            properties_names |= {
                'rating',
                'rating_value',
            }
        return properties_names

    def _portal_message_format(self, properties_names):
        """ If requested, add rating information to returned formatted values.

        Note: rating information combine both statistics (see 'rating_get_stats'
        if available on model) and rating / publication information. """
        vals_list = super()._portal_message_format(properties_names)
        if not 'rating' in properties_names:
            return vals_list

        related_ratings = self.env['rating.rating'].sudo().search_fetch(
            [('message_id', 'in', self.ids)],
            ["id", "message_id", "model", "publisher_comment",
             "publisher_datetime", "publisher_id", "res_id"]
        )
        message_to_rating = {
            rating.message_id.id: self._portal_message_format_rating(rating.read()[0])
            for rating in related_ratings
        }

        for message, values in zip(self, vals_list):
            rating_values = message_to_rating.get(message.id, {})
            if rating_values:
                values["rating"] = rating_values

        message_to_rating_stats = {}
        for model, model_values in self._classify_by_model():
            records = self.env[model].sudo().browse(model_values['record_ids'])
            if hasattr(records, 'rating_get_stats'):
                for message, record in zip(model_values['messages'], records):
                    message_to_rating_stats[message.id] = record.rating_get_stats()

        return vals_list

    def _portal_message_format_rating(self, rating_values):
        """ From 'rating_values' get an updated version formatted for frontend
        display.

        :param dict rating_values: values coming from reading ratings
          in database;

        :return dict: updated rating_values
        """
        publisher_id, publisher_name = rating_values['publisher_id'] or [False, '']
        rating_values['publisher_avatar'] = f'/web/image/res.partner/{publisher_id}/avatar_128/50x50' if publisher_id else ''
        rating_values['publisher_comment'] = rating_values['publisher_comment'] or ''
        rating_values['publisher_datetime'] = format_datetime(self.env, rating_values['publisher_datetime'])
        rating_values['publisher_id'] = publisher_id
        rating_values['publisher_name'] = publisher_name
        return rating_values
