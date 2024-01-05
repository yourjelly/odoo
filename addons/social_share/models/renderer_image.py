# Part of Odoo. See LICENSE file for full copyright and licensing details.

from io import BytesIO
import base64
from PIL import Image

from ..utils.image_render_utils import get_shape, fit_to_mask, get_rgb_from_hex
from .renderer import Renderer

class ShapeRenderer(Renderer):
    def __init__(self, *args, shape='rect', **kwargs):
        self.shape = shape
        super().__init__(self, *args, shape=shape, **kwargs)

class ImageShapeRenderer(ShapeRenderer):
    image: str

    def __init__(self, *args, image='', **kwargs):
        self.image = image
        super().__init__(self, *args, image=image, **kwargs)

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
        image = fit_to_mask(image, self.shape, xy=self.size)
        if any(self.size) and image.size != self.size:
            image = image.crop((0, 0, *self.size))
        return image

class ColorShapeRenderer(ShapeRenderer):
    color: tuple[int, int, int]

    def __init__(self, *args, color:str='000000', **kwargs):
        self.color = get_rgb_from_hex(color)
        super().__init__(self, *args, color=color, **kwargs)

    def render_image(self):
        return get_shape(self.shape or 'rect', self.color, 4, self.size)
