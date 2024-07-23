from lxml import html
from lxml.builder import E
from markupsafe import escape, Markup

from odoo import api, exceptions, fields, models, tools

# Good ratio to have a large image still small enough to stay under 5MB (common limit)
# Close to the 2:1 ratio recommended by twitter and these dimensions are recommended by meta
# https://developers.facebook.com/docs/sharing/webmasters/images/
# https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/summary-card-with-large-image
TEMPLATE_DIMENSIONS = (1200, 630)
TEMPLATE_RATIO = 40 / 21

class CardCampaignTemplate(models.Model):
    _name = 'card.template'
    _description = 'Marketing Card Template'

    name = fields.Char(required=True)
    style = fields.Html(sanitize=True, sanitize_tags=False)
    body = fields.Html(sanitize=True)

    default_background = fields.Image()
    primary_color = fields.Char()
    secondary_color = fields.Char()
    primary_text_color = fields.Char()
    secondary_text_color = fields.Char()

    def _render_document(self, values, color_values):
        """
        """
        body = E.body()
        style = E.style()

        default_style = f"""
        body {{
            @charset "UTF-8";
            {f'background: {escape(self.primary_color)};' if self.primary_color else ''}
            {f'color: {escape(self.primary_text_color)};' if self.primary_text_color else ''}
        }}
        .button_background {{
            {f'background: {escape(self.secondary_color)};' if self.secondary_color else ''}
            {f'color: {escape(self.secondary_text_color)};' if self.secondary_text_color else ''}
        }}
        """

        if self.style:
            style = E.style(default_style + escape(html.fromstring(self.style).find('.//head/style').text))
        if self.body:
            body = self._process_body(values, color_values)
        # build the document
        # removing the wrapper div of "body" and replace it with an empty "body"
        # background-image is also forcefully applied as it cannot be set inside the style sheet due to wkhtmltoimage restrictions
        body_attrs = {}
        if values.get('background'):
            body_attrs.update(style=f"background-image: url('data:image/png;base64,{escape(values['background'])}');")
        body = E.body(*body, **body_attrs)
        document_tree = E.html(E.head(E.meta(charset="utf-8"), style), body)
        return html.tostring(document_tree).decode()

    def _process_body(self, values, color_values):
        """Apply directives to the body based on the passed-in values."""
        body = html.fromstring(self.body)
        while (element := body.getparent().find('.//*[@odoo-render-if-any]')) is not None:
            keys = element.attrib.pop('odoo-render-if-any', '').split(',')
            if keys and not any(values.get(key) for key in keys):
                element.getparent().remove(element)
        while (element := body.getparent().find('.//*[@odoo-render-if-all]')) is not None:
            keys = element.attrib.pop('odoo-render-if-all', '').split(',')
            if keys and all(values.get(key) for key in keys):
                element.getparent().remove(element)
        for element in body.getparent().findall('.//*[@odoo-set-text-color]'):
            if color := color_values.get(element.attrib.pop('odoo-set-text-color'), ''):
                element.attrib['style'] = element.attrib.get('style', '') + f"color: {escape(color)};"
        for element in body.getparent().findall('.//*[@odoo-set-text]'):
            element.text = values.get(element.attrib.pop('odoo-set-text'), '')
        for element in body.getparent().findall('.//*[@odoo-set-src]'):
            if b64_image := values.get(element.attrib.pop('odoo-set-src'), ''):
                element.attrib['src'] = f"data:image/png;base64,{escape(b64_image)}"
        # sanitize the result of dynamic changes
        sanitized_body = html.fromstring(tools.html_sanitize(html.tostring(body).decode()))
        return sanitized_body

    def _update_from_view(self, view_id):
        arch = self.env['ir.ui.view']._get(view_id)._get_combined_arch()
        self.body = html.tostring(arch.find('.//div[@id="body-wrapper"]'))
        self.style = html.tostring(E.style('\n'.join([stylenode.text for stylenode in arch.findall('.//head/style')])))
