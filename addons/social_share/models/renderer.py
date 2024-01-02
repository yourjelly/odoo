
class Renderer:
    def __init__(self, *args, pos=(0, 0), size=(0, 0), **kwargs):
        self.pos = pos
        self.size = size
        super().__init__()

    @staticmethod
    def from_template_element(element, replaced_values=None):
        vals = {
            'pos': (element.x_pos, element.y_pos),
            'size': (element.x_size, element.y_size),
        }
        vals.update(replaced_values)
        return Renderer(**vals)


    def _get_bounds(self):
        return (self.pos, tuple(pos + size for pos, size in zip(self.pos, self.size)))

    def render_image(self):
        return b''
