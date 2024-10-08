# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json

from odoo import _
from odoo.exceptions import UserError, AccessError

from openai import OpenAI

class BusinessCardScanner:

    def extract_data(self, card_image_data, data_url_prefix, api_key):
        """Perform OCR in the file using the Vision API with an API key and extract data using IAP service of OpenAI."""
        if not card_image_data:
            return None

        client = OpenAI(api_key=api_key)

        image_content = card_image_data.decode("utf-8")
        prompt = (
            "From the image give me business_name, owners_name, phone_numbers(in a python list), email, website, address. "
            "and if we not get a value of above parameters give null. make it in json format and nothing else."
        )

        try:
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "user", "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {
                            "url": f"{data_url_prefix}{image_content}"}
                        }
                    ]}
                ],
            )
            response_content = response.choices[0].message.content
            result = response_content[response_content.find('{'):(response_content.rfind('}') + 1)]
            extracted_data = json.loads(result)
            return extracted_data
        except Exception as e:
            raise UserError(
                _("Sorry, we could not generate a response. Please try again later. \n\n%s" % e)
            )
