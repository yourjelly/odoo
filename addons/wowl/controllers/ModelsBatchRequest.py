from odoo import http
import requests
from logging import getLogger
import json

_logger = getLogger(__name__)

class ModelsBatchRequest(http.Controller):

    @http.route('/wowl/batch-models', type='json', auth='none', methods=['POST'])
    def handle(self, **kw):
        pass

