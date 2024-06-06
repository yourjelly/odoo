import logging
from odoo import models

_logger = logging.getLogger(__name__)

try:
    from num2cyrillic import NumberToWords

    num2bg = NumberToWords()
except ImportError:
    _logger.warning(
        "The num2cyrillic python library is not installed, amount-to-text features in bulgarian won't be fully available.")
    num2bg = None


class Currency(models.Model):
    _inherit = 'res.currency'

    def _num2words(self, number, lang):
        if num2bg:
            return num2bg.cyrillic(number)
        else:
            _logger.warning("The library 'num2cyrillic' is missing, falling back to parent method")
            return super()._num2words(number, lang)
