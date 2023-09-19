# Part of Odoo. See LICENSE file for full copyright and licensing details.
import contextlib
import logging
import re
import werkzeug.urls
from lxml import etree
from unittest.mock import Mock, MagicMock, patch

from werkzeug.exceptions import NotFound
from werkzeug.test import EnvironBuilder

import odoo
from odoo.modules.module import get_manifest
from odoo.tests.common import HttpCase, HOST
from odoo.tools import escape_psql
from odoo.tools.misc import DotDict, frozendict

_logger = logging.getLogger(__name__)


@contextlib.contextmanager
def MockRequest(
        env, *, path='/mockrequest', routing=True, multilang=True,
        context=frozendict(), cookies=frozendict(), country_code=None,
        website=None, remote_addr=HOST, environ_base=None,
        # website_sale
        sale_order_id=None, website_sale_current_pl=None,
):

    lang_code = context.get('lang', env.context.get('lang', 'en_US'))
    env = env(context=dict(context, lang=lang_code))
    request = Mock(
        # request
        httprequest=Mock(
            host='localhost',
            path=path,
            app=odoo.http.root,
            environ=dict(
                EnvironBuilder(
                    path=path,
                    base_url=HttpCase.base_url(),
                    environ_base=environ_base,
                ).get_environ(),
                REMOTE_ADDR=remote_addr,
            ),
            cookies=cookies,
            referrer='',
            remote_addr=remote_addr,
        ),
        type='http',
        future_response=odoo.http.FutureResponse(),
        params={},
        redirect=env['ir.http']._redirect,
        session=DotDict(
            odoo.http.get_default_session(),
            geoip={'country_code': country_code},
            sale_order_id=sale_order_id,
            website_sale_current_pl=website_sale_current_pl,
        ),
        geoip=odoo.http.GeoIP('127.0.0.1'),
        db=env.registry.db_name,
        env=env,
        registry=env.registry,
        cr=env.cr,
        uid=env.uid,
        context=env.context,
        lang=env['res.lang']._lang_get(lang_code),
        website=website,
        render=lambda *a, **kw: '<MockResponse>',
    )
    if website:
        request.website_routing = website.id

    # The following code mocks match() to return a fake rule with a fake
    # 'routing' attribute (routing=True) or to raise a NotFound
    # exception (routing=False).
    #
    #   router = odoo.http.root.get_db_router()
    #   rule, args = router.bind(...).match(path)
    #   # arg routing is True => rule.endpoint.routing == {...}
    #   # arg routing is False => NotFound exception
    router = MagicMock()
    match = router.return_value.bind.return_value.match
    if routing:
        match.return_value[0].routing = {
            'type': 'http',
            'website': True,
            'multilang': multilang
        }
    else:
        match.side_effect = NotFound

    def update_context(**overrides):
        request.context = dict(request.context, **overrides)

    request.update_context = update_context

    with contextlib.ExitStack() as s:
        odoo.http._request_stack.push(request)
        s.callback(odoo.http._request_stack.pop)
        s.enter_context(patch('odoo.http.root.get_db_router', router))

        yield request

# Fuzzy matching tools

def distance(s1="", s2="", limit=4):
    """
    Limited Levenshtein-ish distance (inspired from Apache text common)
    Note: this does not return quick results for simple cases (empty string, equal strings)
        those checks should be done outside loops that use this function.

    :param s1: first string
    :param s2: second string
    :param limit: maximum distance to take into account, return -1 if exceeded

    :return: number of character changes needed to transform s1 into s2 or -1 if this exceeds the limit
    """
    BIG = 100000  # never reached integer
    if len(s1) > len(s2):
        s1, s2 = s2, s1
    l1 = len(s1)
    l2 = len(s2)
    if l2 - l1 > limit:
        return -1
    boundary = min(l1, limit) + 1
    p = [i if i < boundary else BIG for i in range(0, l1 + 1)]
    d = [BIG for _ in range(0, l1 + 1)]
    for j in range(1, l2 + 1):
        j2 = s2[j - 1]
        d[0] = j
        range_min = max(1, j - limit)
        range_max = min(l1, j + limit)
        if range_min > 1:
            d[range_min - 1] = BIG
        for i in range(range_min, range_max + 1):
            if s1[i - 1] == j2:
                d[i] = p[i - 1]
            else:
                d[i] = 1 + min(d[i - 1], p[i], p[i - 1])
        p, d = d, p
    return p[l1] if p[l1] <= limit else -1

def similarity_score(s1, s2):
    """
    Computes a score that describes how much two strings are matching.

    :param s1: first string
    :param s2: second string

    :return: float score, the higher the more similar
        pairs returning non-positive scores should be considered non similar
    """
    dist = distance(s1, s2)
    if dist == -1:
        return -1
    set1 = set(s1)
    score = len(set1.intersection(s2)) / len(set1)
    score -= dist / len(s1)
    score -= len(set1.symmetric_difference(s2)) / (len(s1) + len(s2))
    return score

def text_from_html(html_fragment, collapse_whitespace=False):
    """
    Returns the plain non-tag text from an html

    :param html_fragment: document from which text must be extracted

    :return: text extracted from the html
    """
    # lxml requires one single root element
    tree = etree.fromstring('<p>%s</p>' % html_fragment, etree.XMLParser(recover=True))
    content = ' '.join(tree.itertext())
    if collapse_whitespace:
        content = re.sub('\\s+', ' ', content).strip()
    return content

def get_base_domain(url, strip_www=False):
    """
    Returns the domain of a given url without the scheme and the www. and the
    final '/' if any.

    :param url: url from which the domain must be extracted
    :param strip_www: if True, strip the www. from the domain

    :return: domain of the url
    """
    if not url:
        return ''

    url = werkzeug.urls.url_parse(url).netloc
    if strip_www and url.startswith('www.'):
        url = url[4:]
    return url

# Generated primary snippet templates

def generate_primary_snippet_templates(env, module):
    def split_key(snippet_key):
        # Snippets xmlid can be written without the module part, meaning it is
        # a shortcut for a website module snippet.
        return snippet_key.split('.') if '.' in snippet_key else ('website', snippet_key)

    def create_model_data(missing_records):
        # Creates the model data records for newly created template records.
        env['ir.model.data'].create([{
            'name': record.key.split('.')[1],
            'module': record.key.split('.')[0],
            'model': 'ir.ui.view',
            'res_id': record.id,
            'noupdate': False,
        } for record in missing_records])

    def create_missing(create_values):
        # Creates the snippet primary template records that do not exist yet.
        # Safety net in case something goes wrong, it should not be possible
        # but it is a low effort to do it.
        create_values = [values for values in create_values if values]
        keys = [values['key'] for values in create_values]
        existing_primary_template_keys = env['ir.ui.view'].search_fetch([('mode', '=', 'primary'), ('key', 'in', keys)], ['key']).mapped('key')
        missing_create_values = [values for values in create_values if values['key'] not in existing_primary_template_keys]
        missing_records = env['ir.ui.view'].with_context(no_cow=True).create(missing_create_values)
        create_model_data(missing_records)
        # Prevent deletion by _process_end
        for values in create_values:
            env['ir.model.data']._load_xmlid(values["key"])
        return len(missing_records.ids)

    def get_create_vals(name, snippet_key, parent_wrap, new_wrap):
        # Returns the create values for the new primary template of the
        # snippet having snippet_key as its base key, having a new key
        # formatted with new_wrap, and extending a parent with the key
        # formatted with parent_wrap.
        mod, xmlid = split_key(snippet_key)
        parent_key = f'{mod}.{parent_wrap % xmlid}'
        parent_id = env['ir.model.data']._xmlid_to_res_model_res_id(parent_key, False)
        if not parent_id:
            _logger.warning('No such snippet template: %s', parent_key)
            return None
        return {
            'name': name,
            'key': f'{mod}.{new_wrap % xmlid}',
            'inherit_id': parent_id[1],
            'mode': 'primary',
            'type': 'qweb',
            'arch': '<t/>',
        }

    def get_distinct_snippet_names(structure):
        # Returns the distinct leaves of the structure (tree leaf's list elements).
        items = []
        for value in structure.values():
            if isinstance(value, list):
                items.extend(value)
            else:
                items.extend(get_distinct_snippet_names(value))
        return set(items)

    create_count = 0
    manifest = get_manifest(module)
    # Configurator
    configurator_snippets = manifest['configurator_snippets']

    # Generate general configurator snippet templates

    create_values = []
    # Every distinct snippet name across all configurator pages.
    for snippet_name in get_distinct_snippet_names(configurator_snippets):
        create_values.append(get_create_vals(
            f"Snippet {snippet_name} for pages generated by the configurator",
            snippet_name, '%s', 'configurator_%s'
        ))
    create_count += create_missing(create_values)

    # Generate configurator snippet templates for specific pages

    create_values = []
    for page_name in configurator_snippets:
        for snippet_name in configurator_snippets[page_name]:
            create_values.append(get_create_vals(
                f"Snippet {snippet_name} for {page_name} pages generated by the configurator",
                snippet_name, 'configurator_%s', f'configurator_{page_name}_%s'
            ))
    create_count += create_missing(create_values)

    # New page templates
    templates = manifest['new_page_templates']

    # Generate general new page snippet templates

    create_values = []
    # Every distinct snippet name across all new page templates.
    for snippet_name in get_distinct_snippet_names(templates):
        create_values.append(get_create_vals(
            f"Snippet {snippet_name} for new page templates",
            snippet_name, '%s', 'new_page_template_%s'
        ))
    create_count += create_missing(create_values)

    # Generate new page snippet templates for new page template groups

    create_values = []
    for group in templates:
        # Every distinct snippet name across all new page templates of group.
        for snippet_name in get_distinct_snippet_names(templates[group]):
            create_values.append(get_create_vals(
                f"Snippet {snippet_name} for new page {group} templates",
                snippet_name, 'new_page_template_%s', f'new_page_template_{group}_%s'
            ))
    create_count += create_missing(create_values)

    # Generate new page snippet templates for specific new page templates within groups

    create_values = []
    for group in templates:
        for template_name in templates[group]:
            for snippet_name in templates[group][template_name]:
                create_values.append(get_create_vals(
                    f"Snippet {snippet_name} for new page {group} template {template_name}",
                    snippet_name, f'new_page_template_{group}_%s', f'new_page_template_{group}_{template_name}_%s'
                ))
    create_count += create_missing(create_values)

    if create_count:
        _logger.info('Generated %s primary snippet templates for %r', create_count, module)

    if module == 'website':
        # TODO Find a way to create theme and other module's template patches
        # Create or update template views per group x key
        create_values = []
        for group in templates:
            for template_name in templates[group]:
                xmlid = f'{module}.new_page_template_sections_{group}_{template_name}'
                wrapper = f'%s.new_page_template_{group}_{template_name}_%s'
                calls = ''.join([
                    f'<t t-snippet-call="{wrapper % split_key(snippet_key)}"/>'
                    for snippet_key in templates[group][template_name]
                ])
                create_values.append({
                    'name': f"New page template: {group} #{template_name}",
                    'type': 'qweb',
                    'key': xmlid,
                    'arch': f'<div id="wrap">{calls}</div>',
                })
        keys = [values['key'] for values in create_values]
        existing_primary_templates = env['ir.ui.view'].search_read([('mode', '=', 'primary'), ('key', 'in', keys)], ['key'])
        existing_primary_template_keys = {data['key']: data['id'] for data in existing_primary_templates}
        missing_create_values = []
        update_count = 0
        for create_value in create_values:
            if create_value['key'] in existing_primary_template_keys:
                env['ir.ui.view'].browse(existing_primary_template_keys[create_value['key']]).with_context(no_cow=True).write({
                    'arch': create_value['arch'],
                })
                update_count += 1
            else:
                missing_create_values.append(create_value)
        if missing_create_values:
            missing_records = env['ir.ui.view'].create(missing_create_values)
            create_model_data(missing_records)
            _logger.info('Generated %s primary page templates for %r', len(missing_create_values), module)
        # Prevent deletion by _process_end
        for values in create_values:
            env['ir.model.data']._load_xmlid(values['key'])
        if update_count:
            _logger.info('Updated %s primary page templates for %r', update_count, module)

    if module == 'website':
        # Invoke for themes and website_* - otherwise on -u website, the
        # additional primary snippets they require are deleted by _process_end.
        for module in env['ir.module.module'].search([
            ('state', '=', 'installed'),
            '|',
            ('name', '=like', f'{escape_psql("theme_")}%'),
            ('name', '=like', f'{escape_psql("website_")}%'),
        ]):
            generate_primary_snippet_templates(env, module.name)
