
import math
import textwrap
from PIL import ImageDraw, Image

def get_rgb_from_hex(color_string):
        """:param str color_string: hex representation of rgb in hexadecimal"""
        color_string = color_string.lstrip("#")
        if not isinstance(color_string, str) or len(color_string) != 6:
            raise ValueError('Invalid color string', color_string)
        r, g, b = (int(color_string[start:start + 2], 16) for start in range(0, 6, 2))
        return (r, g, b)

def get_shape(shape='rect', color=(0, 0, 0, 255), ssscale=1, xy=(0, 0), sampler=Image.LANCZOS):
    """Get a shape sampled from a shape `ssscale` times bigger to avoid aliasing, if necessary.

    :param str shape: any of the valid image_crop selection value for <social.share.image.render.element>
    :param tuple[int; 3] | tuple[int; 4] color: 8-bit RGB color with or without alpha channel
    :param int ssscale: how much to scale the image before supersampling
    :param tuple[int, int]: size in x and y
    :param int Image: valid Image supersampling value from PIL
    """
    dimensions = (xy[0] * ssscale, xy[1] * ssscale) if shape != 'rect' else xy
    image = Image.new('RGBA', dimensions, (0, 0, 0, 0))
    editor = ImageDraw.ImageDraw(image)

    if shape == 'rect':
        editor.rectangle((0, 0, *dimensions), fill=color)
        return image
    if shape == 'circ':
        editor.ellipse((0, 0, *dimensions), fill=color)
    elif shape == 'roundrect':
        editor.rounded_rectangle((0, 0, *dimensions), fill=color, radius=dimensions[1])
    return image.resize(xy, sampler)

def get_text_size(text, font):
    """Get the width and height of some text based on current font."""
    return font.getsize(text)

def wrap_text(text, font, xy):
    """Take in text and return a list of lines that fit within the given size, with their size."""
    (_, _), (x_size, _) = xy
    if not x_size:
        return [(line, get_text_size(line, font)) for line in text.split('\n')]

    char_width, _ = get_text_size(text, font)
    one_char_width = char_width / len(text)
    if one_char_width > x_size:
        raise Exception("The text cannot fit in the requested size with this font, increase width")
    approximate_max_line_char = math.ceil(x_size / one_char_width)

    input_text_lines = text.split('\n')
    text_lines = []
    for line in input_text_lines:
        if len(line) == 0:
            text_lines.append('')
        text_lines += textwrap.wrap(line, approximate_max_line_char)
    return [(line, get_text_size(line, font)) for line in text_lines]

def align_text(text, font, xy, align_method='left'):
    """Take in text and return a list of positions and text lines to draw the text aligned in some manner.

    :return list[tuple[tuple[tuple[int, int], tuple[int, int]], str]]: [((min_x, min_y), (max_x, max_y)), text)]
    """
    (x, y), (x_size, _) = xy
    lines = wrap_text(text, font, xy)
    _, one_char_height = get_text_size('w', font)
    positioned_lines = []
    if align_method == 'left':
        current_y = y
        for line, (line_x_size, line_y_size) in lines:
            positioned_lines.append((
                ((x, current_y), (x + line_x_size, current_y + (line_y_size or one_char_height))),
                line
            ))
            current_y += line_y_size
        return positioned_lines
    if not x_size:
        raise ValueError('Text with no width bounds cannot be alligned to {align_method}')
    if align_method == 'center':
        current_y = y
        for line, (line_x_size, line_y_size) in lines:
            x_diff = (x_size - line_x_size) / 2
            positioned_lines.append((
                (
                    (x + x_diff, current_y),
                    (x_size - x_diff, current_y + (line_y_size or one_char_height))
                ), line
            ))
            current_y += line_y_size
        return positioned_lines
    raise ValueError(f'Invalid align method: {align_method}')

def fit_to_mask(image, crop_type, xy=None):
    """Fit image to a mask of shape `crop_type` and dimensions `xy`.

    :param Image image: PIL image
    :param str crop_type: any of the valid image_crop selection value for <social.share.image.render.element>
    :param tuple[int, int] xy: size in x and y
    """
    if not crop_type:
        return image
    else:
        if xy is not None and any(xy):
            x_size, y_size = xy
            ix_size, iy_size = image.size
            x_diff = max(ix_size - x_size, 0)
            y_diff = max(iy_size - y_size, 0)
            image = image.crop((x_diff / 2, y_diff / 2, ix_size - x_diff / 2, iy_size - y_diff / 2))
        else:
            xy = image.size
        shape = get_shape(shape=crop_type, ssscale=4, xy=xy)
        shape = shape.crop((0, 0, *( min(i_size, s_size) for i_size, s_size in zip(image.size, shape.size))))
        shape.paste(image, (0, 0), shape)
        return shape

def text_fits_height(text, font, xy, editor):
    (x, y), (_, y_size) = xy
    _, start_y, _, end_y = editor.textbbox((x, y), text, font=font)
    if end_y - start_y > y_size:
        return False
    return True
