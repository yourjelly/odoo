# Part of Odoo. See LICENSE file for full copyright and licensing details.

from io import BytesIO
import base64
from PIL import Image

from ..utils.image_render_utils import get_shape, fit_to_mask, get_rgb_from_hex
from .renderer import Renderer

class ImageShapeRenderer(Renderer):

    def get_image(self):
        if self.image:
            return self.image
        #elif self.image_url:
        #    try:
        #        response = requests.request('get', self.image_url, timeout=5)
        #        return base64.b64encode(response.content)
        #    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError, requests.exceptions.HTTPError):
        #        return None
        return None

    def render_image(self):
        image = Image.open(BytesIO(base64.b64decode(self.image))).convert('RGBA')
        image = fit_to_mask(image, self.shape, xy=self._get_size())
        if any(self._get_size()) and image.size != self._get_size():
            image = image.crop((0, 0, *self._get_size()))
        return image

class ColorShapeRenderer(Renderer):

    def render_image(self):
        return get_shape(self.shape or 'rect', get_rgb_from_hex(self.color), 4, self._get_size())
