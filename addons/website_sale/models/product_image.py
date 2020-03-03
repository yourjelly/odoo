# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import base64
import json
import requests
import re

from odoo import api, fields, models, tools, _
from odoo.exceptions import ValidationError

from odoo.addons.website.tools import get_video_embed_code
from odoo.modules.module import get_module_resource


def get_video_source_with_document_id(video_url):
    ''' Computes the valid source and document ID from given URL
        (or False in case of invalid URL).
    '''
    if not video_url:
        return False

     # To detect if we have a valid URL or not
    validURLRegex = r'^(http:\/\/|https:\/\/|\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$'

    # Regex for few of the widely used video hosting services
    ytRegex = r'^(?:(?:https?:)?\/\/)?(?:www\.)?(?:youtu\.be\/|youtube(-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((?:\w|-){11})(?:\S+)?$'
    vimeoRegex = r'\/\/(player.)?vimeo.com\/([a-z]*\/)*([0-9]{6,11})[?]?.*'
    dmRegex = r'.+dailymotion.com\/(video|hub|embed)\/([^_]+)[^#]*(#video=([^_&]+))?'
    igRegex = r'(.*)instagram.com\/p\/(.[a-zA-Z0-9]*)'

    if not re.search(validURLRegex, video_url):
        return False
    else:
        ytMatch = re.search(ytRegex, video_url)
        vimeoMatch = re.search(vimeoRegex, video_url)
        dmMatch = re.search(dmRegex, video_url)
        igMatch = re.search(igRegex, video_url)

        if ytMatch and len(ytMatch.groups()[1]) == 11:
            return ('youtube', ytMatch.groups()[1])
        elif vimeoMatch:
            return ('vimeo', video_url)
        elif dmMatch:
            return ('dailymotion', dmMatch.groups()[1])
        elif igMatch:
            return ('instagram', igMatch.groups()[1])
        else:
            return (None, None)


class ProductImage(models.Model):
    _name = 'product.image'
    _description = "Product Image"
    _inherit = ['image.mixin']
    _order = 'sequence, id'

    name = fields.Char("Name", required=True)
    sequence = fields.Integer(default=10, index=True)

    image_1920 = fields.Image(required=True)

    product_tmpl_id = fields.Many2one('product.template', "Product Template", index=True, ondelete='cascade')
    product_variant_id = fields.Many2one('product.product', "Product Variant", index=True, ondelete='cascade')
    video_url = fields.Char('Video URL',
                            help='URL of a video for showcasing your product.')
    embed_code = fields.Char(compute="_compute_embed_code")

    can_image_1024_be_zoomed = fields.Boolean("Can Image 1024 be zoomed", compute='_compute_can_image_1024_be_zoomed', store=True)

    @api.depends('image_1920', 'image_1024')
    def _compute_can_image_1024_be_zoomed(self):
        for image in self:
            image.can_image_1024_be_zoomed = image.image_1920 and tools.is_image_size_above(image.image_1920, image.image_1024)

    def set_thumbnail_image(self,video_url=None):
        status = False
        source = get_video_source_with_document_id(self.video_url or video_url)
        if source and hasattr(self, '_parse_%s_thumbnail' % source[0]):
            status = getattr(self, '_parse_%s_thumbnail' % source[0])(source[1])
        # In case of unknown provider or  private video we set default image.
        if (self.video_url or video_url) and (source[0] == None or not status):
            #set a default image
            image_path = get_module_resource('web', 'static/src/img', 'placeholder.png')
            image = base64.b64encode(open(image_path, 'rb').read())
            status = tools.image_process(image)
        return status

    @api.onchange('video_url')
    def _onchange_video_url(self):
        self.image_1920 = self.set_thumbnail_image()

    @api.depends('video_url')
    def _compute_embed_code(self):
        for image in self:
            image.embed_code = get_video_embed_code(image.video_url)

    def _parse_youtube_thumbnail(self, document_id):
        r = requests.get('https://img.youtube.com/vi/'+ document_id + '/0.jpg')
        if r.status_code != 200:
            return False
        return tools.image_process(base64.b64encode(r.content))

    def _parse_dailymotion_thumbnail(self, document_id):
        r = requests.get('https://www.dailymotion.com/thumbnail/video/'+ document_id)
        if r.status_code != 200:
            return False
        return tools.image_process(base64.b64encode(r.content))

    def _parse_vimeo_thumbnail(self, video_url):
        vimeo_req = requests.get('https://vimeo.com/api/oembed.json?url='+ video_url)
        if vimeo_req.status_code != 200:
            return False
        data = json.loads(vimeo_req.content)
        r = requests.get(data['thumbnail_url'])
        return tools.image_process(base64.b64encode(r.content))

    def _parse_instagram_thumbnail(self, document_id):
        r = requests.get('https://www.instagram.com/p/'+ document_id + '/media/?size=t')
        if r.status_code != 200:
            return False
        return tools.image_process(base64.b64encode(r.content))
    @api.constrains('video_url')
    def _check_valid_video_url(self):
        for image in self:
            if image.video_url and not image.embed_code:
                raise ValidationError(_("Provided video URL for '%s' is not valid. Please enter a valid video URL.") % image.name)

    @api.model_create_multi
    def create(self, vals_list):
        """
            We don't want the default_product_tmpl_id from the context
            to be applied if we have a product_variant_id set to avoid
            having the variant images to show also as template images.
            But we want it if we don't have a product_variant_id set.
        """
        context_without_template = self.with_context({k: v for k, v in self.env.context.items() if k != 'default_product_tmpl_id'})
        normal_vals = []
        variant_vals_list = []

        for vals in vals_list:
            if vals.get('product_variant_id') and 'default_product_tmpl_id' in self.env.context:
                variant_vals_list.append(vals)
            else:
                normal_vals.append(vals)

        return super().create(normal_vals) + super(ProductImage, context_without_template).create(variant_vals_list)
