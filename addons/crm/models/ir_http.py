import base64
from odoo import models
from odoo.http import request
from werkzeug import exceptions
from hashlib import sha256
import json

class IrHttp(models.AbstractModel):
    _inherit = 'ir.http'

    @classmethod
    def _auth_method_gmail(cls):
        if request.httprequest.method == "OPTIONS":
            return True

        token = dict(request.httprequest.headers).get('Authorization')
        split_token = token.split('.')
        token_signature = split_token[-1]

        error_message = cls._check_gmail_token_signature(token_signature)

        if not error_message:
            preprocessed_payload = split_token[1]
            payload = cls._process_gmail_token_payload(preprocessed_payload)
            user_id = payload.get('user_id')
            if user_id:
                user = request.env['res.users'].browse(user_id)
                if user:
                    request.env.user = user
                else:
                    error_message = 'No user found'
            else:
                error_message = "Invalid token"

        if error_message:
            raise exceptions.BadRequest(error_message)

        return True

    @classmethod
    def _check_gmail_token_signature(cls, token_signature):
        database_secret = request.env['ir.config_parameter'].sudo().get_param('database.secret')
        original_signature = sha256(database_secret.encode('utf-8')).hexdigest()

#!!!!!compare_digest
        return "Invalid token" if token_signature != original_signature else False

    @classmethod
    def _process_gmail_token_payload(cls, preprocessed_payload):
        payload = preprocessed_payload.split("'")[1]

        payload_string = base64.b64decode(payload).decode('utf-8')
        return json.loads(payload_string)