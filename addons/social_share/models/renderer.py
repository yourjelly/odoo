from abc import ABC, abstractmethod
from PIL import Image


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
