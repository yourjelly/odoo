
class Renderer:
    @staticmethod
    def _get_proxy_fields():
        return ['_template_element']

    def __init__(self, template_element, *args, **kwargs):
        self._template_element = template_element

    def __getattr__(self, attr):
        if attr in self._get_proxy_fields():
            return super().__getattr__(attr)
        return getattr(self._template_element, attr)

    def __setattr__(self, key, val):
        if key in self._get_proxy_fields():
            return super().__setattr__(key, val)
        setattr(self._template_element, key, val)

    def render_image(self):
        return b''
