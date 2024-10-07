# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import base64
import collections
import difflib
import io
import itertools
import logging
import random
import re
import socket
import time
import email.utils
from email.utils import getaddresses as orig_getaddresses
from urllib.parse import urlparse
import html as htmllib

import idna
import markupsafe
import nh3
from lxml import etree, html
from lxml.html import clean, defs
from werkzeug import urls

from odoo.tools import misc

__all__ = [
    "email_domain_extract",
    "email_domain_normalize",
    "email_normalize",
    "email_normalize_all",
    "email_split",
    "encapsulate_email",
    "formataddr",
    "html2plaintext",
    "html_normalize",
    "html_sanitize",
    "is_html_empty",
    "parse_contact_from_email",
    "plaintext2html",
    "single_email_re",
]

_logger = logging.getLogger(__name__)


# disable strict mode when present: we rely on original non-strict
# parsing, and we know that it isn't reliable, that ok.
# cfr python/cpython@4a153a1d3b18803a684cd1bcc2cdf3ede3dbae19
if hasattr(email.utils, 'supports_strict_parsing'):
    def getaddresses(fieldvalues):
        return orig_getaddresses(fieldvalues, strict=False)
else:
    getaddresses = orig_getaddresses


#----------------------------------------------------------
# HTML Sanitizer
#----------------------------------------------------------

safe_attrs = defs.safe_attrs | frozenset(
    ['style',
     'data-o-mail-quote', 'data-o-mail-quote-node',  # quote detection
     'data-oe-model', 'data-oe-id', 'data-oe-field', 'data-oe-type', 'data-oe-expression', 'data-oe-translation-source-sha', 'data-oe-nodeid',
     'data-last-history-steps', 'data-oe-protected', 'data-embedded', 'data-embedded-editable', 'data-embedded-props', 'data-oe-version',
     'data-oe-transient-content', 'data-behavior-props', 'data-prop-name',  # legacy editor
     'data-publish', 'data-id', 'data-res_id', 'data-interval', 'data-member_id', 'data-scroll-background-ratio', 'data-view-id',
     'data-class', 'data-mimetype', 'data-original-src', 'data-original-id', 'data-gl-filter', 'data-quality', 'data-resize-width',
     'data-shape', 'data-shape-colors', 'data-file-name', 'data-original-mimetype',
     'data-mimetype-before-conversion',
     ])
SANITIZE_TAGS = {
    # allow new semantic HTML5 tags
    'allow_tags': defs.tags | frozenset('article bdi section header footer hgroup nav aside figure main'.split() + [etree.Comment]),
    'kill_tags': ['base', 'embed', 'frame', 'head', 'iframe', 'link', 'meta',
                  'noscript', 'object', 'script', 'style', 'title'],
    'remove_tags': ['html', 'body'],
}


class _Cleaner(clean.Cleaner):

    _style_re = re.compile(r'''([\w-]+)\s*:\s*((?:[^;"']|"[^";]*"|'[^';]*')+)''')

    _style_whitelist = [
        'font-size', 'font-family', 'font-weight', 'font-style', 'background-color', 'color', 'text-align',
        'line-height', 'letter-spacing', 'text-transform', 'text-decoration', 'text-decoration', 'opacity',
        'float', 'vertical-align', 'display',
        'padding', 'padding-top', 'padding-left', 'padding-bottom', 'padding-right',
        'margin', 'margin-top', 'margin-left', 'margin-bottom', 'margin-right',
        'white-space',
        # box model
        'border', 'border-color', 'border-radius', 'border-style', 'border-width', 'border-top', 'border-bottom',
        'height', 'width', 'max-width', 'min-width', 'min-height',
        # tables
        'border-collapse', 'border-spacing', 'caption-side', 'empty-cells', 'table-layout']

    _style_whitelist.extend(
        ['border-%s-%s' % (position, attribute)
            for position in ['top', 'bottom', 'left', 'right']
            for attribute in ('style', 'color', 'width', 'left-radius', 'right-radius')]
    )

    strip_classes = False
    sanitize_style = False

    def __call__(self, doc):
        super(_Cleaner, self).__call__(doc)

        # if we keep attributes but still remove classes
        if not getattr(self, 'safe_attrs_only', False) and self.strip_classes:
            for el in doc.iter(tag=etree.Element):
                self.strip_class(el)

        # if we keep style attribute, sanitize them
        if not self.style and self.sanitize_style:
            for el in doc.iter(tag=etree.Element):
                self.parse_style(el)

    def strip_class(self, el):
        if el.attrib.get('class'):
            del el.attrib['class']

    def parse_style(self, el):
        attributes = el.attrib
        styling = attributes.get('style')
        if styling:
            valid_styles = collections.OrderedDict()
            styles = self._style_re.findall(styling)
            for style in styles:
                if style[0].lower() in self._style_whitelist:
                    valid_styles[style[0].lower()] = style[1]
            if valid_styles:
                el.attrib['style'] = '; '.join('%s:%s' % (key, val) for (key, val) in valid_styles.items())
            else:
                del el.attrib['style']


def tag_quote(el):
    el_class = el.get('class') or ''
    el_id = el.get('id') or ''

    # gmail or yahoo // # outlook, html // # msoffice
    if 'gmail_extra' in el_class or \
            'divRplyFwdMsg' in el_id or \
            ('SkyDrivePlaceholder' in el_class or 'SkyDrivePlaceholder' in el_class):
        el.set('data-o-mail-quote', '1')
        if el.getparent() is not None:
            el.getparent().set('data-o-mail-quote-container', '1')

    if (el.tag == 'hr' and ('stopSpelling' in el_class or 'stopSpelling' in el_id)) or \
       'yahoo_quoted' in el_class:
        # Quote all elements after this one
        el.set('data-o-mail-quote', '1')
        for sibling in el.itersiblings(preceding=False):
            sibling.set('data-o-mail-quote', '1')

    # html signature (-- <br />blah)
    signature_begin = re.compile(r"((?:(?:^|\n)[-]{2}[\s]?$))")
    if el.text and el.find('br') is not None and re.search(signature_begin, el.text):
        el.set('data-o-mail-quote', '1')
        if el.getparent() is not None:
            el.getparent().set('data-o-mail-quote-container', '1')

    # text-based quotes (>, >>) and signatures (-- Signature)
    if (text := el.text) and not el.get('data-o-mail-quote'):
        attrs = {'data-o-mail-quote': '1'}

        child_node = None
        idx = 0
        text_patterns = re.compile(r"((?:\n>+[^\n\r]*)+|(?:^|\n)-{2}\s?[\r\n]{1,2}[\s\S]+)")
        for node_idx, item in enumerate(text_patterns.finditer(text)):
            if child_node is None:
                el.text = text[idx:item.start()]
            else:
                child_node.tail = text[idx:item.start()]

            child_node = etree.Element('span', attrib=attrs)
            child_node.text = item[0]
            child_node.tail = text[item.end():]
            el.insert(node_idx, child_node)

            idx = item.end()

    if el.tag == 'blockquote':
        # remove single node
        el.set('data-o-mail-quote-node', '1')
        el.set('data-o-mail-quote', '1')
    elif (p := el.getparent()) is not None and (p.get('data-o-mail-quote') or p.get('data-o-mail-quote-container')) and not p.get('data-o-mail-quote-node'):
        el.set('data-o-mail-quote', '1')


def html_normalize(src, filter_callback=None):
    """ Normalize `src` for storage as an html field value.

    The string is parsed as an html tag soup, made valid, then decorated for
    "email quote" detection, and prepared for an optional filtering.
    The filtering step (e.g. sanitization) should be performed by the
    `filter_callback` function (to avoid multiple parsing operations, and
    normalize the result).

    :param src: the html string to normalize
    :param filter_callback: optional callable taking a single `etree._Element`
        document parameter, to be called during normalization in order to
        filter the output document
    """
    if not (src and src.strip()):
        return ""

    # html: remove XML declaration if it contains an encoding, as lxml chokes
    #       on explicit encoding in unicode strings
    src = re.sub(r"""
^\ufeff? # an XML declaration starts with the document except for an optional bom
<\?xml
    \s+
        version
        \s*=\s*
        (['"])1.[0-9]+\1
    \s+
        encoding\s*=\s*['"]
    [^>]+
\?>
""",
        "",
        src,
        flags=re.VERBOSE,
    )

    # malformed and conditional comments
    src = src.replace('--!>', '-->')
    src = re.sub(r'(<!-->|<!--->)', '<!-- -->', src)
    # On the specific case of Outlook desktop it adds unnecessary '<o:.*></o:.*>' tags which are parsed
    # in '<p></p>' which may alter the appearance (eg. spacing) of the mail body
    # FIXME: move this to HTML cleaner?
    src = re.sub(r'</?o:.*?>', '', src)

    try:
        doc = html.fromstring(src)
    except etree.ParserError as e:
        # HTML comment only string, whitespace only..
        if 'empty' in str(e):
            return ""
        raise

    for el in doc.iter(tag=etree.Element):
        tag_quote(el)

    if filter_callback:
        doc = filter_callback(doc)

    out = html.tostring(doc, encoding='unicode')

    # this is ugly, but lxml/etree tostring want to put everything in a
    # 'div' that breaks the editor -> remove that
    if out.startswith('<div>') and out.endswith('</div>'):
        out = out[5:-6]

    # html considerations so real html content match database value
    out = out.replace('\xa0', '&nbsp;')

    return out


def html_sanitize(src, silent=True, sanitize_tags=True, sanitize_attributes=False, sanitize_style=False, sanitize_form=True, strip_style=False, strip_classes=False):
    if not src:
        return src

    logger = logging.getLogger(__name__ + '.html_sanitize')

    def sanitize_handler(doc):
        kwargs = {
            'page_structure': True,
            'style': strip_style,              # True = remove style tags/attrs
            'sanitize_style': sanitize_style,  # True = sanitize styling
            'forms': sanitize_form,            # True = remove form tags
            'remove_unknown_tags': False,
            'comments': False,
            'processing_instructions': False
        }
        if sanitize_tags:
            kwargs.update(SANITIZE_TAGS)

        if sanitize_attributes:  # We keep all attributes in order to keep "style"
            if strip_classes:
                current_safe_attrs = safe_attrs - frozenset(['class'])
            else:
                current_safe_attrs = safe_attrs
            kwargs.update({
                'safe_attrs_only': True,
                'safe_attrs': current_safe_attrs,
            })
        else:
            kwargs.update({
                'safe_attrs_only': False,  # keep oe-data attributes + style
                'strip_classes': strip_classes,  # remove classes, even when keeping other attributes
            })

        cleaner = _Cleaner(**kwargs)
        cleaner(doc)
        return doc

    try:
        t0 = time.perf_counter_ns()
        sanitized = html_normalize(src, filter_callback=sanitize_handler)
        t = time.perf_counter_ns() - t0
    except etree.ParserError:
        if not silent:
            raise
        logger.warning(u'ParserError obtained when sanitizing %r', src, exc_info=True)
        sanitized = '<p>ParserError when sanitizing</p>'
        t = float('inf')
    except Exception:
        if not silent:
            raise
        logger.warning(u'unknown error obtained when sanitizing %r', src, exc_info=True)
        sanitized = '<p>Unknown error when sanitizing</p>'
        t = float('inf')

    # NOTE: ammonia / nh3 does not support ignoring PI (?)
    opts = {
        'strip_comments': False,
        'link_rel': None,
    }
    if sanitize_tags:
        kill_tags = opts['clean_content_tags'] = set(SANITIZE_TAGS['kill_tags'])
        opts['tags'] = SANITIZE_TAGS['allow_tags'].difference(
            {etree.Comment},
            SANITIZE_TAGS['remove_tags'],
            kill_tags,
        )
    else:
        "FIXME: how do you allow all tags?"
        # in lxml.html.Clearner, if allow_tags is falsy (empty or none) then we
        # don't process that bit at all
        # this is only done by a location which wants to strip_classes without
        # applying and
        # card.template.body (sanitize_tags=False, sanitize_attributes=False)
        #       => complete bypass (strip_class is false by default)

    # page_structure=True is an alias for remove_tags |= {head, html, title}
    # sanitize_form=True is an alias for remove_tags |= {form} kill_tags |= {button, input, select, textarea}
    # remove_unknown_tags=True is an alias for allow_tags = defs.tags
    # processing_instructions=True is an alias for kill_tags |= ProcessingInstruction
    # comments=True is an alias for kill_tags |= Comments
    if sanitize_attributes:
        attrs = safe_attrs
        if strip_style:
            attrs -= {'style'}
        opts['attributes'] = {'*': attrs}
        if strip_classes:
            opts['attributes']['*'] -= {'class'}
    else:
        opts['generic_attribute_prefixes'] = {''}
        if strip_classes:
            opts['attribute_filter'] = lambda t, a, v: None if a == 'class' else v

    if not strip_style:
        opts.setdefault('attributes', {'*': frozenset()})['*'] |= {'style'}
        if sanitize_style:
            # fixme: needs to be merged with the previous one
            opts['attribute_filter'] = _sanitize_style

    # without normalisation: 10x perf difference
    # with: 20~50%
    # normalization does:
    # - remove @encoding
    # - replace conditional comments by regular
    # - removes outlook `o:?` tags
    # - catches empty documents, returns empty documents
    # - converts back \xa0 to &nbsp; otherwise values don't round-trip and
    #   causes unnecessary writes
    # - whatever `tag_quote` is up to
    t0 = time.perf_counter_ns()
    if normalized := html_normalize(src):
        ammoniazed = nh3.clean(normalized, **opts)
    else:
        ammoniazed = ""
    tt = time.perf_counter_ns() - t0

    ns_to_ms = 1_000_000
    if max(t, tt) > 10 * ns_to_ms:
        if ammoniazed == sanitized:
            _logger.runbot(
                "%d bytes: %d ms -> %d ms",
                len(src.encode()),
                t // ns_to_ms,
                tt // ns_to_ms
            )
        else:
            _logger.runbot(
                "%d bytes: %d ms -> %d ms (%.1fx) (%d b -> %d b)\n%s",
                len(src.encode()),
                t // ns_to_ms,
                tt // ns_to_ms,
                t / tt,
                len(sanitized.encode()),
                len(ammoniazed.encode()),
                "".join(difflib.unified_diff(
                    sanitized.splitlines(keepends=True),
                    ammoniazed.splitlines(keepends=True),
                    "sanitized",
                    "ammoniazed",
                ))
            )

    return markupsafe.Markup(sanitized)


def _sanitize_style(el: str, att: str, attval: str) -> str | None:
    match el, att:
        case _, 'style':
            valid_styles = [
                f"{style[0].lower()}:{style[1]}"
                for style in _Cleaner._style_re.findall(attval)
                if style[0].lower() in _Cleaner._style_whitelist
            ]
            if valid_styles:
                return '; '.join(valid_styles)
            else:
                return None
        case _:
            return attval


# ----------------------------------------------------------
# HTML/Text management
# ----------------------------------------------------------

URL_SKIP_PROTOCOL_REGEX = r'mailto:|tel:|sms:'
URL_REGEX = rf'''(\bhref=['"](?!{URL_SKIP_PROTOCOL_REGEX})([^'"]+)['"])'''
TEXT_URL_REGEX = r'https?://[\w@:%.+&~#=/-]+(?:\?\S+)?'
# retrieve inner content of the link
HTML_TAG_URL_REGEX = URL_REGEX + r'([^<>]*>([^<>]+)<\/)?'
HTML_TAGS_REGEX = re.compile('<.*?>')
HTML_NEWLINES_REGEX = re.compile('<(div|p|br|tr)[^>]*>|\n')


def validate_url(url):
    if urls.url_parse(url).scheme not in ('http', 'https', 'ftp', 'ftps'):
        return 'http://' + url

    return url


def is_html_empty(html_content):
    """Check if a html content is empty. If there are only formatting tags with style
    attributes or a void content  return True. Famous use case if a
    '<p style="..."><br></p>' added by some web editor.

    :param str html_content: html content, coming from example from an HTML field
    :returns: bool, True if no content found or if containing only void formatting tags
    """
    if not html_content:
        return True
    tag_re = re.compile(r'\<\s*\/?(?:p|div|section|span|br|b|i|font)(?:(?=\s+\w*)[^/>]*|\s*)/?\s*\>')
    return not bool(re.sub(tag_re, '', html_content).strip())

def html_keep_url(text):
    """ Transform the url into clickable link with <a/> tag """
    idx = 0
    final = ''
    link_tags = re.compile(r"""(?<!["'])((ftp|http|https):\/\/(\w+:{0,1}\w*@)?([^\s<"']+)(:[0-9]+)?(\/|\/([^\s<"']))?)(?![^\s<"']*["']|[^\s<"']*</a>)""")
    for item in re.finditer(link_tags, text):
        final += text[idx:item.start()]
        final += '<a href="%s" target="_blank" rel="noreferrer noopener">%s</a>' % (item.group(0), item.group(0))
        idx = item.end()
    final += text[idx:]
    return final


def html_to_inner_content(html):
    """Returns unformatted text after removing html tags and excessive whitespace from a
    string/Markup. Passed strings will first be sanitized.
    """
    if is_html_empty(html):
        return ''
    if not isinstance(html, markupsafe.Markup):
        html = html_sanitize(html)
    processed = re.sub(HTML_NEWLINES_REGEX, ' ', html)
    processed = re.sub(HTML_TAGS_REGEX, '', processed)
    processed = re.sub(r' {2,}|\t', ' ', processed)
    processed = htmllib.unescape(processed)
    processed = processed.strip()
    return processed


def html2plaintext(html, body_id=None, encoding='utf-8'):
    """ From an HTML text, convert the HTML to plain text.
    If @param body_id is provided then this is the tag where the
    body (not necessarily <body>) starts.
    """
    ## (c) Fry-IT, www.fry-it.com, 2007
    ## <peter@fry-it.com>
    ## download here: http://www.peterbe.com/plog/html2plaintext
    if not (html and html.strip()):
        return ''

    if isinstance(html, bytes):
        html = html.decode(encoding)
    else:
        assert isinstance(html, str), f"expected str got {html.__class__.__name__}"

    tree = etree.fromstring(html, parser=etree.HTMLParser())

    if body_id is not None:
        source = tree.xpath('//*[@id=%s]' % (body_id,))
    else:
        source = tree.xpath('//body')
    if len(source):
        tree = source[0]

    url_index = []
    linkrefs = itertools.count(1)
    for link in tree.findall('.//a'):
        if url := link.get('href'):
            link.tag = 'span'
            link.text = f'{link.text} [{next(linkrefs)}]'
            url_index.append(url)

    for img in tree.findall('.//img'):
        if src := img.get('src'):
            img.tag = 'span'
            img_name = re.search(r'[^/]+(?=\.[a-zA-Z]+(?:\?|$))', src)
            img.text = '%s [%s]' % (img_name[0] if img_name else 'Image', next(linkrefs))
            url_index.append(src)

    html = etree.tostring(tree, encoding="unicode")
    # \r char is converted into &#13;, must remove it
    html = html.replace('&#13;', '')

    html = html.replace('<strong>', '*').replace('</strong>', '*')
    html = html.replace('<b>', '*').replace('</b>', '*')
    html = html.replace('<h3>', '*').replace('</h3>', '*')
    html = html.replace('<h2>', '**').replace('</h2>', '**')
    html = html.replace('<h1>', '**').replace('</h1>', '**')
    html = html.replace('<em>', '/').replace('</em>', '/')
    html = html.replace('<tr>', '\n')
    html = html.replace('</p>', '\n')
    html = re.sub(r'<br\s*/?>', '\n', html)
    html = re.sub('<.*?>', ' ', html)
    html = html.replace(' ' * 2, ' ')
    html = html.replace('&gt;', '>')
    html = html.replace('&lt;', '<')
    html = html.replace('&amp;', '&')
    html = html.replace('&nbsp;', '\N{NO-BREAK SPACE}')

    # strip all lines
    html = '\n'.join([x.strip() for x in html.splitlines()])
    html = html.replace('\n' * 2, '\n')

    if url_index:
        html += '\n\n'
        for i, url in enumerate(url_index, start=1):
            html += f'[{i}] {url}\n'

    return html.strip()

def plaintext2html(text, container_tag=None):
    r"""Convert plaintext into html. Content of the text is escaped to manage
    html entities, using :func:`~odoo.tools.misc.html_escape`.

    - all ``\n``, ``\r`` are replaced by ``<br/>``
    - enclose content into ``<p>``
    - convert url into clickable link
    - 2 or more consecutive ``<br/>`` are considered as paragraph breaks

    :param str text: plaintext to convert
    :param str container_tag: container of the html; by default the content is
        embedded into a ``<div>``
    :rtype: markupsafe.Markup
    """
    assert isinstance(text, str)
    text = misc.html_escape(text)

    # 1. replace \n and \r
    text = re.sub(r'(\r\n|\r|\n)', '<br/>', text)

    # 2. clickable links
    text = html_keep_url(text)

    # 3-4: form paragraphs
    idx = 0
    final = '<p>'
    br_tags = re.compile(r'(([<]\s*[bB][rR]\s*/?[>]\s*){2,})')
    for item in re.finditer(br_tags, text):
        final += text[idx:item.start()] + '</p><p>'
        idx = item.end()
    final += text[idx:] + '</p>'

    # 5. container
    if container_tag: # FIXME: validate that container_tag is just a simple tag?
        final = '<%s>%s</%s>' % (container_tag, final, container_tag)
    return markupsafe.Markup(final)

def append_content_to_html(html, content, plaintext=True, preserve=False, container_tag=None):
    """ Append extra content at the end of an HTML snippet, trying
        to locate the end of the HTML document (</body>, </html>, or
        EOF), and converting the provided content in html unless ``plaintext``
        is ``False``.

        Content conversion can be done in two ways:

        - wrapping it into a pre (``preserve=True``)
        - use plaintext2html (``preserve=False``, using ``container_tag`` to
          wrap the whole content)

        A side-effect of this method is to coerce all HTML tags to
        lowercase in ``html``, and strip enclosing <html> or <body> tags in
        content if ``plaintext`` is False.

        :param str html: html tagsoup (doesn't have to be XHTML)
        :param str content: extra content to append
        :param bool plaintext: whether content is plaintext and should
            be wrapped in a <pre/> tag.
        :param bool preserve: if content is plaintext, wrap it into a <pre>
            instead of converting it into html
        :param str container_tag: tag to wrap the content into, defaults to `div`.
        :rtype: markupsafe.Markup
    """
    if plaintext and preserve:
        content = '\n<pre>%s</pre>\n' % misc.html_escape(content)
    elif plaintext:
        content = '\n%s\n' % plaintext2html(content, container_tag)
    else:
        content = re.sub(r'(?i)(</?(?:html|body|head|!\s*DOCTYPE)[^>]*>)', '', content)
        content = '\n%s\n' % content
    # Force all tags to lowercase
    html = re.sub(r'(</?)(\w+)([ >])',
        lambda m: '%s%s%s' % (m[1], m[2].lower(), m[3]), html)
    insert_location = html.find('</body>')
    if insert_location == -1:
        insert_location = html.find('</html>')
    if insert_location == -1:
        return markupsafe.Markup('%s%s' % (html, content))
    return markupsafe.Markup('%s%s%s' % (html[:insert_location], content, html[insert_location:]))


def prepend_html_content(html_body, html_content):
    """Prepend some HTML content at the beginning of an other HTML content."""
    replacement = re.sub(r'(?i)(</?(?:html|body|head|!\s*DOCTYPE)[^>]*>)', '', html_content)
    html_content = markupsafe.Markup(replacement) if isinstance(html_content, markupsafe.Markup) else replacement
    html_content = html_content.strip()

    body_match = re.search(r'<body[^>]*>', html_body) or re.search(r'<html[^>]*>', html_body)
    insert_index = body_match.end() if body_match else 0

    return html_body[:insert_index] + html_content + html_body[insert_index:]

#----------------------------------------------------------
# Emails
#----------------------------------------------------------

# matches any email in a body of text
email_re = re.compile(r"""([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63})""", re.VERBOSE)

# matches a string containing only one email
single_email_re = re.compile(r"""^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$""", re.VERBOSE)

mail_header_msgid_re = re.compile('<[^<>]+>')

email_addr_escapes_re = re.compile(r'[\\"]')

def generate_tracking_message_id(res_id):
    """Returns a string that can be used in the Message-ID RFC822 header field

       Used to track the replies related to a given object thanks to the "In-Reply-To"
       or "References" fields that Mail User Agents will set.
    """
    try:
        rnd = random.SystemRandom().random()
    except NotImplementedError:
        rnd = random.random()
    rndstr = ("%.15f" % rnd)[2:]
    return "<%s.%.15f-openerp-%s@%s>" % (rndstr, time.time(), res_id, socket.gethostname())

def email_split_tuples(text):
    """ Return a list of (name, email) address tuples found in ``text`` . Note
    that text should be an email header or a stringified email list as it may
    give broader results than expected on actual text. """
    def _parse_based_on_spaces(pair):
        """ With input 'name email@domain.com' (missing quotes for a formatting)
        getaddresses returns ('', 'name email@domain.com). This when having no
        name and an email a fallback to enhance parsing is to redo a getaddresses
        by replacing spaces by commas. The new email will be split into sub pairs
        allowing to find the email and name parts, allowing to make a new name /
        email pair. Emails should not contain spaces thus this is coherent with
        email formation. """
        name, email = pair
        if not name and email and ' ' in email:
            inside_pairs = getaddresses([email.replace(' ', ',')])
            name_parts, found_email = [], False
            for pair in inside_pairs:
                if pair[1] and '@' not in pair[1]:
                    name_parts.append(pair[1])
                if pair[1] and '@' in pair[1]:
                    found_email = pair[1]
            name, email = (' '.join(name_parts), found_email) if found_email else (name, email)
        return (name, email)

    if not text:
        return []

    # found valid pairs, filtering out failed parsing
    valid_pairs = [
        (addr[0], addr[1]) for addr in getaddresses([text])
        # getaddresses() returns '' when email parsing fails, and
        # sometimes returns emails without at least '@'. The '@'
        # is strictly required in RFC2822's `addr-spec`.
        if addr[1] and '@' in addr[1]
    ]
    # corner case: returning '@gmail.com'-like email (see test_email_split)
    if any(pair[1].startswith('@') for pair in valid_pairs):
        filtered = [
            found_email for found_email in email_re.findall(text)
            if found_email and not found_email.startswith('@')
        ]
        if filtered:
            valid_pairs = [('', found_email) for found_email in filtered]

    return list(map(_parse_based_on_spaces, valid_pairs))

def email_split(text):
    """ Return a list of the email addresses found in ``text`` """
    if not text:
        return []
    return [email for (name, email) in email_split_tuples(text)]

def email_split_and_format(text):
    """ Return a list of email addresses found in ``text``, formatted using
    formataddr. """
    if not text:
        return []
    return [formataddr((name, email)) for (name, email) in email_split_tuples(text)]

def email_normalize(text, strict=True):
    """ Sanitize and standardize email address entries. As of rfc5322 section
    3.4.1 local-part is case-sensitive. However most main providers do consider
    the local-part as case insensitive. With the introduction of smtp-utf8
    within odoo, this assumption is certain to fall short for international
    emails. We now consider that

      * if local part is ascii: normalize still 'lower' ;
      * else: use as it, SMTP-UF8 is made for non-ascii local parts;

    Concerning domain part of the address, as of v14 international domain (IDNA)
    are handled fine. The domain is always lowercase, lowering it is fine as it
    is probably an error. With the introduction of IDNA, there is an encoding
    that allow non-ascii characters to be encoded to ascii ones, using 'idna.encode'.

    A normalized email is considered as :
    - having a left part + @ + a right part (the domain can be without '.something')
    - having no name before the address. Typically, having no 'Name <>'
    Ex:
    - Possible Input Email : 'Name <NaMe@DoMaIn.CoM>'
    - Normalized Output Email : 'name@domain.com'

    :param boolean strict: if True, text should contain a single email
      (default behavior in stable 14+). If more than one email is found no
      normalized email is returned. If False the first found candidate is used
      e.g. if email is 'tony@e.com, "Tony2" <tony2@e.com>', result is either
      False (strict=True), either 'tony@e.com' (strict=False).

    :return: False if no email found (or if more than 1 email found when being
      in strict mode); normalized email otherwise;
    """
    emails = email_split(text)
    if not emails or (strict and len(emails) != 1):
        return False

    local_part, at, domain = emails[0].rpartition('@')
    try:
        local_part.encode('ascii')
    except UnicodeEncodeError:
        pass
    else:
        local_part = local_part.lower()

    return local_part + at + domain.lower()

def email_normalize_all(text):
    """ Tool method allowing to extract email addresses from a text input and returning
    normalized version of all found emails. If no email is found, a void list
    is returned.

    e.g. if email is 'tony@e.com, "Tony2" <tony2@e.com' returned result is ['tony@e.com, tony2@e.com']

    :return list: list of normalized emails found in text
    """
    if not text:
        return []
    emails = email_split(text)
    return list(filter(None, [email_normalize(email) for email in emails]))

def email_domain_extract(email):
    """ Extract the company domain to be used by IAP services notably. Domain
    is extracted from email information e.g:

    - info@proximus.be -> proximus.be
    """
    normalized_email = email_normalize(email)
    if normalized_email:
        return normalized_email.split('@')[1]
    return False

def email_domain_normalize(domain):
    """Return the domain normalized or False if the domain is invalid."""
    if not domain or '@' in domain:
        return False

    return domain.lower()

def url_domain_extract(url):
    """ Extract the company domain to be used by IAP services notably. Domain
    is extracted from an URL e.g:

    - www.info.proximus.be -> proximus.be
    """
    parser_results = urlparse(url)
    company_hostname = parser_results.hostname
    if company_hostname and '.' in company_hostname:
        return '.'.join(company_hostname.split('.')[-2:])  # remove subdomains
    return False

def email_escape_char(email_address):
    """ Escape problematic characters in the given email address string"""
    return email_address.replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')

# was mail_thread.decode_header()
def decode_message_header(message, header, separator=' '):
    return separator.join(h for h in message.get_all(header, []) if h)

def formataddr(pair, charset='utf-8'):
    """Pretty format a 2-tuple of the form (realname, email_address).

    If the first element of pair is falsy then only the email address
    is returned.

    Set the charset to ascii to get a RFC-2822 compliant email. The
    realname will be base64 encoded (if necessary) and the domain part
    of the email will be punycode encoded (if necessary). The local part
    is left unchanged thus require the SMTPUTF8 extension when there are
    non-ascii characters.

    >>> formataddr(('John Doe', 'johndoe@example.com'))
    '"John Doe" <johndoe@example.com>'

    >>> formataddr(('', 'johndoe@example.com'))
    'johndoe@example.com'
    """
    name, address = pair
    local, _, domain = address.rpartition('@')

    try:
        domain.encode(charset)
    except UnicodeEncodeError:
        # rfc5890 - Internationalized Domain Names for Applications (IDNA)
        domain = idna.encode(domain).decode('ascii')

    if name:
        try:
            name.encode(charset)
        except UnicodeEncodeError:
            # charset mismatch, encode as utf-8/base64
            # rfc2047 - MIME Message Header Extensions for Non-ASCII Text
            name = base64.b64encode(name.encode('utf-8')).decode('ascii')
            return f"=?utf-8?b?{name}?= <{local}@{domain}>"
        else:
            # ascii name, escape it if needed
            # rfc2822 - Internet Message Format
            #   #section-3.4 - Address Specification
            name = email_addr_escapes_re.sub(r'\\\g<0>', name)
            return f'"{name}" <{local}@{domain}>'
    return f"{local}@{domain}"


def encapsulate_email(old_email, new_email):
    """Change the FROM of the message and use the old one as name.

    e.g.
    * Old From: "Admin" <admin@gmail.com>
    * New From: notifications@odoo.com
    * Output: "Admin" <notifications@odoo.com>
    """
    old_email_split = getaddresses([old_email])
    if not old_email_split or not old_email_split[0]:
        return old_email

    new_email_split = getaddresses([new_email])
    if not new_email_split or not new_email_split[0]:
        return

    old_name, old_email = old_email_split[0]
    if old_name:
        name_part = old_name
    else:
        name_part = old_email.split("@")[0]

    return formataddr((
        name_part,
        new_email_split[0][1],
    ))

def parse_contact_from_email(text):
    """ Parse contact name and email (given by text) in order to find contact
    information, able to populate records like partners, leads, ...
    Supported syntax:

      * Raoul <raoul@grosbedon.fr>
      * "Raoul le Grand" <raoul@grosbedon.fr>
      * Raoul raoul@grosbedon.fr (strange fault tolerant support from
        df40926d2a57c101a3e2d221ecfd08fbb4fea30e now supported directly
        in 'email_split_tuples';

    Otherwise: default, text is set as name.

    :return: name, email (normalized if possible)
    """
    if not text or not text.strip():
        return '', ''
    split_results = email_split_tuples(text)
    name, email = split_results[0] if split_results else ('', '')

    if email:
        email_normalized = email_normalize(email, strict=False) or email
    else:
        name, email_normalized = text, ''

    return name, email_normalized
