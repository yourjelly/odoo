from abc import ABC, abstractmethod
from PIL import Image

from odoo import models


class Renderer(ABC):
    pos: tuple[int, int]
    size: tuple[int, int]

    def __init__(self, *args, pos=(0, 0), size=(0, 0), **kwargs):
        self.pos = pos
        self.size = size
        super().__init__()

    def _get_bounds(self):
        return (self.pos, tuple(pos + size for pos, size in zip(self.pos, self.size)))

    @abstractmethod
    def render_image(self, *args, **kwargs) -> Image.Image | None:
        return None

class FieldRenderer(Renderer):
    field_path: str
    model: models.Model

    def __init__(self, *args, field_path='', model=None, **kwargs):
        self.field_path = field_path
        self.model = model
        super().__init__(self, *args, field_path=field_path, model=model, **kwargs)

    @abstractmethod
    def render_image(self, *args, record=None, **kwargs):
        return None

    def get_field_value(self, record=None):
        field = self.field_path
        record = record if record is not None else self.model
        if record:
            return record[field] if record[field] else None
        return ''

    def get_field_name(self, record=None):
        field_name = record.env['ir.model.fields'].sudo().search([
            ('model_id', '=', record._name), ('name', '=', self.field_path)
        ], limit=1).name
        return field_name
