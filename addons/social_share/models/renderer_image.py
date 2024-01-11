# Part of Odoo. See LICENSE file for full copyright and licensing details.

from io import BytesIO
import base64
from PIL import Image
from abc import abstractmethod

from ..utils.image_render_utils import get_shape, fit_to_mask, get_rgb_from_hex
from .renderer import FieldRenderer, Renderer
from .renderer_text import UserTextRenderer

class ShapeRenderer(Renderer):
    def __init__(self, *args, shape='rect', **kwargs):
        self.shape = shape
        super().__init__(self, *args, shape=shape, **kwargs)

class ImageShapeRenderer(ShapeRenderer):
    @abstractmethod
    def get_image(self, *args, **kwargs):
        return ''

    def render_image(self, *args, record=None, **kwargs):
        if not self.image:
            return None
        image = Image.open(BytesIO(base64.b64decode(self.get_image(record=None)))).convert('RGBA')
        image = fit_to_mask(image, self.shape, xy=self.size)
        if any(self.size) and image.size != self.size:
            image = image.crop((0, 0, *self.size))
        return image

class ImageFieldShapeRenderer(ImageShapeRenderer, FieldRenderer):
    def get_image(self, *args, record=None, **kwargs):
        return self.get_field_value(record=record)

    def render_image(self, *args, record=None, **kwargs):
        if self.get_field_value(record=record):
            return super(ImageShapeRenderer, self).render_image(*args, record=record, **kwargs)
        return UserTextRenderer(text=f'[{self.get_field_name(record=record)}]').render_image()

class ImageStaticShapeRenderer(ImageShapeRenderer):
    def __init__(self, *args, image='', **kwargs):
        self.image = image or ''
        super().__init__(self, *args, image=image, **kwargs)

    def get_image(self, *args, **kwargs):
        return self.image

class ColorShapeRenderer(ShapeRenderer):
    color: tuple[int, int, int]

    def __init__(self, *args, color: str = '000000', **kwargs):
        self.color = get_rgb_from_hex(color or '000000')
        super().__init__(self, *args, color=color, **kwargs)

    def render_image(self, *args, **kwargs):
        if not self.shape:
            return None
        return get_shape(self.shape or 'rect', self.color, 4, self.size)
