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
    refs = {}

    def ref(xmlid):
        if xmlid not in refs:
            refs[xmlid] = env.ref(xmlid).id
        return refs[xmlid]

    def split_key(snippet_key):
        return snippet_key.split('.') if '.' in snippet_key else ('website', snippet_key)

    def create_model_data(ids, values_list):
        env['ir.model.data'].create([{
            'name': values_list[index]['key'].split('.')[1],
            'module': values_list[index]['key'].split('.')[0],
            'model': 'ir.ui.view',
            'res_id': ids[index],
        } for index in range(0, len(ids))])
        # Prevent deletion by _process_end
        for values in values_list:
            env['ir.model.data']._load_xmlid(values["key"])

    def create_missing(values_list):
        values_list = [values for values in values_list if values]
        keys = [values['key'] for values in values_list]
        existing_primary_templates = env['ir.ui.view'].search_read([('mode', '=', 'primary'), ('key', 'in', keys)], ['key'])
        refs.update({data['key']: data['id'] for data in existing_primary_templates})
        existing_primary_template_keys = [data['key'] for data in existing_primary_templates]
        missing_values_list = [values for values in values_list if values['key'] not in existing_primary_template_keys]
        ids = env['ir.ui.view'].create(missing_values_list).ids
        refs.update({missing_values_list[index]['key']: ids[index] for index in range(0, len(ids))})
        create_model_data(ids, missing_values_list)
        return len(ids)

    def generate_primary(title, snippet_key, parent_wrap, new_wrap):
        mod, name = split_key(snippet_key)
        parent_key = f'{mod}.{parent_wrap % name}'
        try:
            parent_id = ref(parent_key)
        except ValueError:
            _logger.warning('No such snippet template: %s', parent_key)
            return None
        return {
            'name': title,
            'key': f'{mod}.{new_wrap % name}',
            'inherit_id': parent_id,
            'mode': 'primary',
            'type': 'qweb',
            'arch': '<t/>',
        }

    create_count = 0
    manifest = get_manifest(module)
    # Configurator
    if 'snippet_lists' in manifest:
        snippet_lists = manifest['snippet_lists']
        configurator_snippets = {name for key in snippet_lists for name in snippet_lists[key]}
        values_list = []
        for name in configurator_snippets:
            values_list.append(generate_primary(
                f"Snippet {name} for pages generated by the configurator",
                name, '%s', 'configurator_%s'
            ))
        create_count += create_missing(values_list)
        values_list = []
        for key in snippet_lists:
            for name in snippet_lists[key]:
                values_list.append(generate_primary(
                    f"Snippet {name} for {key} pages generated by the configurator",
                    name, 'configurator_%s', f'configurator_{key}_%s'
                ))
        create_count += create_missing(values_list)

    # New page templates
    if 'new_page_templates' in manifest:
        templates = manifest['new_page_templates']
        new_page_snippets = {name for group in templates for key in templates[group] for name in templates[group][key]}
        values_list = []
        for name in new_page_snippets:
            values_list.append(generate_primary(
                f"Snippet {name} for new page templates",
                name, '%s', 'new_page_template_%s'
            ))
        create_count += create_missing(values_list)
        values_list = []
        for group in templates:
            template_group_snippets = {name for key in templates[group] for name in templates[group][key]}
            for name in template_group_snippets:
                values_list.append(generate_primary(
                    f"Snippet {name} for new page {group} templates",
                    name, 'new_page_template_%s', f'new_page_template_{group}_%s'
                ))
        create_count += create_missing(values_list)
        values_list = []
        for group in templates:
            for key in templates[group]:
                for name in templates[group][key]:
                    values_list.append(generate_primary(
                        f"Snippet {name} for new page {group} template {key}",
                        name, f'new_page_template_{group}_%s', f'new_page_template_{group}_{key}_%s'
                    ))
        create_count += create_missing(values_list)

        # Create or update template views per group x key
        values_list = []
        for group in templates:
            for key in templates[group]:
                xmlid = f'{module}.new_page_template_sections_{group}_{key}'
                wrapper = f'%s.new_page_template_{group}_{key}_%s'
                calls = ''.join([
                    f'<t t-snippet-call="{wrapper % split_key(snippet_key)}"/>'
                    for snippet_key in templates[group][key]
                ])
                values_list.append({
                    'name': f"New page template: {group} #{key}",
                    'type': 'qweb',
                    'key': xmlid,
                    'arch': f'<div id="wrap">{calls}</div>',
                })
        keys = [values['key'] for values in values_list]
        existing_primary_templates = env['ir.ui.view'].search_read([('mode', '=', 'primary'), ('key', 'in', keys)], ['key'])
        existing_primary_template_keys = [data['key'] for data in existing_primary_templates]
        missing_values_list = [values for values in values_list if values['key'] not in existing_primary_template_keys]
        if missing_values_list:
            ids = env['ir.ui.view'].create(missing_values_list).ids
            create_model_data(ids, missing_values_list)
            _logger.info('Generated %s primary page templates for %s', len(missing_values_list), module)
        if existing_primary_templates:
            for existing_primary_template in existing_primary_templates:
                values = [
                    values
                    for values in filter(
                        lambda values: values['key'] == existing_primary_template['key'],
                        values_list
                    )
                ][0]
                env['ir.ui.view'].browse(existing_primary_template['id']).write({'arch': values['arch']})
            _logger.info('Updated %s primary page templates for %s', len(existing_primary_templates), module)

    if create_count:
        _logger.info('Generated %s primary snippet templates for %s', create_count, module)
