from datetime import datetime
from lxml import etree
from odoo import api
from werkzeug import urls

import logging
import odoo.tests
import re
import time

_logger = logging.getLogger(__name__)

_windown_action = 'ir.actions.act_window'
_blacklist = ['mail.alias']
_force_create_relational = ['account.move']
_forged_values = {
    'char':"XSS injection test (char)",
    'text':"XSS injection test (text)",
    'float':6.66,
    'integer':6,
    'monetary': 6.66,
    'date':datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    'datetime':datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    'html':'''
        <img src=x onerror="console.error('Booo');">
        <script>
            document.write(\"<a href='/booooooooooooooo'>\");
            document.write(\"Click Here (trust me)\");
            document.write(\"</a>\");
        </script>
        ''',
    'bool': True,
    'boolean': True,
}

@odoo.tests.tagged('black_magic', '-at_install', 'post_install', '-standard')
class BlackMagicCrawler(odoo.tests.HttpCase):

    def setUp(self):
        super(BlackMagicCrawler, self).setUp()

        def search_read(env, model, fields=[]):
            return env[model].search_read([], fields.copy())  

        def create(env, model, fields):
            ret = env[model].create(fields.copy())
            return ret

        def write(env, model, id, fields):
            record = read(env, model, id)
            ret = record.write(fields.copy())
            return ret

        def read(env, model, rid):
            return env[model].browse([rid])

        def get_action_ids(env):
            actions = search_read(env, 'ir.ui.menu', fields=['id', 'parent_id', 
                                                        'parent_path', 'action', 'name'])
            action_ids = []

            for action in actions:
                if action['action'] and action['action'].startswith(_windown_action):
                    action_ids.append(int(action['action'].split(',')[1]))

            action_ids.sort(reverse=True)
            return action_ids

        def load_action(env, action_id):
            action = env['ir.actions.actions'].sudo().browse([action_id]).read()
            return action[0]

        def get_model(env, action_id):
            result = env['ir.actions.act_window'].sudo().browse(action_id).read(['res_model'])
            return result[0]['res_model']

        def get_views(env, action_id, model):
            action = load_action(env, action_id)
            views = action['binding_view_types'].split(',')
            ret = []
            for view in views:
                ret.append([False,view])

            options={"action_id": action_id, "load_filters": False, "toolbar": False}
            result = env[model].get_views(ret, options=options)
            return result['views']

        def get_linked_models(env, action_id, model):
            views = [[False,"list"],[False,"form"],[False,"kanban"],[False,"search"]]
            options={"action_id": action_id, "load_filters": False, "toolbar": False}

            result = env[model].get_views(views, options=options)
            return result['models']

        def get_fields(env, model):
            return env[model].fields_get()

        def _is_model(env, model, operation):
            return env[model].check_access_rights(operation=operation, 
                                                    raise_exception=False)

        def is_model_readable(env, model):
            return _is_model(env, model, 'read')

        def is_model_editable(env, model):
            return _is_model(env, model, 'write')

        def is_model_creatable(env, model):
            return _is_model(env, model, 'create')

        def _is_view(views, method):
            ret = False
            for view in views:
                if view == 'search':
                    continue

                arch = views[view]['arch']
            
                parser = etree.HTMLParser()
                tree = etree.fromstring(arch, parser=parser)
                try:
                    is_method = tree.xpath(f'//./@{method}')[0]
                except IndexError:
                    is_method = '1'
                
                ret = (ret or is_method not in ['false', '0'])
                # If one view is creatable, then the model is creatable
                
            return ret

        def is_view_creatable(views):
            return _is_view(views, 'create')

        def is_view_editable(views):
            return _is_view(views, 'edit')
            
        def get_fields_from_view(view):
            parser = etree.HTMLParser()
            tree = etree.fromstring(view, parser=parser)
            return tree.xpath('.//field/@name')

        def _get_type_fields(fields, _type, with_readonly=False):
            ret = []
            for field in fields:
                try:
                    v = fields[field]
                    if v['type'] == _type and (with_readonly or not v['readonly']):
                        ret.append(field)
                except KeyError:
                    continue
            return ret

        def get_html_fields(fields):
            return _get_type_fields(fields, 'html')

        def get_m2o_fields(fields):
            return _get_type_fields(fields, 'many2one')

        def get_required_fields(fields, with_readonly=False):
            ret = []
            for field in fields:
                v = fields[field]
                try:
                    if v['required'] and (with_readonly or not v['readonly']):
                        ret.append(field)
                except KeyError:
                    continue
            return ret

        def write_record_flow(env, model):
            fields_definition = get_fields(env, model)
            
            html_fields = dict.fromkeys(get_html_fields(fields_definition))
            if not html_fields:
                return []

            for hf in html_fields:
                html_fields[hf] = _forged_values['html']

            extra_write = {}
            if model == 'slide.slide':
                extra_write['url'] = None
                
            rids = []
            for rid in search_read(env, model, fields=['id']):
                try:
                    id = rid['id']
                    write(env, model, id, {**html_fields, **extra_write})    
                    rids.append(id)
                except Exception as e:
                    continue

            return rids

        def create_record_flow(env, model, force=False):
            fields_definition = get_fields(env, model)

            html_fields = get_html_fields(fields_definition)
            if not force and not html_fields:
                return ''
            
            required_fields = get_required_fields(fields_definition, with_readonly=True)
            for field in required_fields:
                if fields_definition[field]['type'] == 'many2one':
                    rel_model = fields_definition[field]['relation']
                    if not is_model_readable(env, rel_model): 
                        required_fields.remove(field)
                    
            fields_to_forge = html_fields + required_fields

            if model == 'account.payment':
                fields_to_forge += ['payment_method_line_id']

            fields = env[model].default_get(fields_definition)

            for ftf in fields_to_forge:
                type = fields_definition[ftf]['type']
                value = fields.get(ftf)

                if value and type != 'html':
                    fields[ftf] = value
                    continue

                else:
                    forged_value = _forged_values.get(type)

                    if forged_value:
                        fields[ftf] = forged_value

                    else:
                        if type == 'selection':
                            selection = fields_definition[ftf]['selection'][0]
                            fields[ftf] = selection[0]
                        elif type == 'many2one':
                            rel_model = fields_definition[ftf]['relation']
                                                
                            is_readable = is_model_readable(env, rel_model)
                            is_creatable = is_model_creatable(env, rel_model)

                            rel_id = ''
                            if is_readable:
                                rel_ids = search_read(env, rel_model, fields = ['id'])
                                if rel_ids:
                                    rel_id = rel_ids[0]['id']

                            if ((not rel_id and is_creatable) or 
                                                rel_model in _force_create_relational):
                                rel_id = create_record_flow(env, rel_model, force=True)[0]
                            
                            if rel_id and rel_model not in _blacklist: 
                                fields[ftf] = rel_id

                        elif type == 'one2many':
                            pass
                        else:
                            del fields[ftf]

            record = create(env, model, fields)
            return [record.id]

        def update_user_flow(env, user):
            if env.uid != user.id:
                return
            
            html_fields = get_html_fields(user.fields_get())
            fields = {}
            for hf in html_fields:
                fields[hf] = _forged_values['html']
            ret = user.write(fields)
            return ret

        def get_demo_with_access_rights(env):
            demo = env['res.users'].search([('login', '=', 'demo')])
            fields = {}

            for k,v in demo.fields_get().items():
                if 'Bypass' in v['string']:
                    fields[k] = False

                if 'Website' in v['string']:
                    selection = v.get('selection', [])
                    for selection_val, selection_str in selection:
                        if 'Restricted Editor' in selection_str:
                            fields[k] = selection_val
                            break
                    
            demo.write(fields)
            return demo
    
        demo = get_demo_with_access_rights(self.env)
        denv = api.Environment(self.env.cr, demo.id, {}) 
        update_user_flow(denv, demo)
        action_ids = get_action_ids(denv)

        xss = {}
        seen = []
        for action_id in action_ids:
            root_model = get_model(denv, action_id)
            views = get_views(denv, action_id, root_model)
            view_editable = is_view_editable(views)
            view_creatable = is_view_creatable(views)

            if not view_creatable and not view_editable:
                continue

            models = get_linked_models(denv, action_id, root_model)
            for model in models:
                if model in seen:
                    continue
                else:
                    seen.append(model)

                model_readable = is_model_readable(denv, model)
                model_creatable = is_model_creatable(denv, model)
                model_editable = is_model_editable(denv, model)

                if not model_readable:
                    continue

                rids = ''
                if view_editable and model_editable:
                    rids = write_record_flow(denv, model)
                    
                if not rids and view_creatable and model_creatable:
                    rids = create_record_flow(denv, model)

                if not rids:
                    continue

                # Use env and not denv since demo onjects and admin reads 
                record = read(self.env, model, rids[0])
                for hf in get_html_fields(get_fields(self.env, model)):
                    if _forged_values['html'] in record[hf]:
                        if model not in xss:
                            xss[model] = {
                                'fields': {},
                                'id': '',
                            }
                        xss[model]['id'] = rids[0] if len(rids) == 1 else '*'
                        xss[model]['fields'][hf] = True

        if not xss:
            _logger.info('INFO: No dark magic detected!')
        else:          
            for model in xss:
                _logger.warning(f'WARNING: {model} has unsanitized field(s) {xss[model]["fields"]} at id {xss[model]["id"]}')
            
    def test_10_front_crawl(self):
        def crawl(self, url, seen = {}):
            url_slug = re.sub(r"[/](([^/=?&]+-)?[0-9]+)([/]|$)", '/<slug>/', url) # replaces /abc-123/ by /<slug>/
            url_slug = re.sub(r"([^/=?&]+)=[^/=?&]+", '\g<1>=param', url_slug) # replaces abcb=1234 by abcd=param
            if url_slug in seen:
                return seen
            else:
                seen[url_slug] = True

            r = self.url_open(url, allow_redirects=False)
            if r.status_code in (301, 302, 303):
                # check local redirect to avoid fetch externals pages
                new_url = r.headers.get('Location')
                current_url = r.url
                if urls.url_parse(new_url).netloc != urls.url_parse(current_url).netloc:
                    return seen
                r = self.url_open(new_url)

            code = r.status_code
            self.assertIn(code, range(200, 300), "Fetching %s returned error response (%d)" % (url, code))

            if r.headers['Content-Type'].startswith('text/html'):
                parser = etree.HTMLParser()
                doc = etree.fromstring(r.content, parser=parser)
                
                # 1. Get the links in page
                links = doc.xpath('//a[@href]')

                # 2. Get the links in scripts
                r = r'''<a href='[/\w]+'>'''
                for script in doc.xpath('//script'):
                    result = re.search(r, str(script.text))
                    if result:
                        tag = etree.fromstring(result.group(), parser=parser)
                        links += tag.xpath('//a[@href]')
                
                for link in links:
                    href = link.get('href')

                    parts = urls.url_parse(href)
                    # href with any fragment removed
                    href = parts.replace(fragment='').to_url()
                    
                    # FIXME: handle relative link (not parts.path.startswith /)
                    if parts.netloc or \
                        not parts.path.startswith('/') or \
                        parts.path == '/web' or\
                        parts.path.startswith('/web/') or \
                        parts.path.startswith('/en_US/') or \
                        (parts.scheme and parts.scheme not in ('http', 'https')):
                        continue

                    crawl(self, href, seen)

            return seen

        t0 = time.time()
        self.authenticate('admin', 'admin')
        seen = crawl(self, '/')
        count = len(seen)
        duration = time.time() - t0
        _logger.runbot("admin crawled %s urls in %.2fs", count, duration)

    def test_10_back_crawl(self):
        def generate_backend_urls(self):
            seen = []
            urls = []

            menus = self.env['ir.ui.menu'].load_menus(False)
            for id, menu_item in menus.items():
                if not menu_item.get('action'):
                    continue

                if menu_item['app_id'] in seen:
                    continue
                seen.append(menu_item['app_id'])

                action_id = menu_item['action'].split(',')[1]
                url = f"/web?debug=1#action_id={action_id}&menu_id={menu_item['app_id']}&cids=1%2C2%2C3%2C4%2C5"
                        
                urls.append((url, menu_item['name']))

            return urls

        code = """
            const MOUSE_EVENTS = ["click"];

            async function triggerClick(target, elDescription) {
                if (target) {
                    console.log("Clicking on", elDescription);
                } else {
                    throw new Error(`No element "${elDescription}" found.`);
                }
                MOUSE_EVENTS.forEach((type) => {
                    const event = new MouseEvent(type, { bubbles: true, cancelable: true, view: window });
                    target.dispatchEvent(event);
                });
            }

            function sleep(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            async function click_notebook() {
                const pages = document.querySelectorAll("div.o_notebook_headers > ul.nav > li.nav-item > a.nav-link.undefined");
                if(!pages) {
                    return;
                }
                for (const page of pages) {
                    await triggerClick(page, page);
                    await sleep(250);
                }
            }

            async function click_form_view() {
                const record = document.querySelector("div.o_content > div.o_list_renderer > table > tbody tr.o_data_row > td.o_data_cell");
                if(!record) {
                    return;
                }
                await triggerClick(record, record);
                await sleep(1000);
                await click_notebook();
            }

            async function remove_filters() {
                const filters = document.querySelectorAll("div.o_searchview_input_container > div.o_searchview_facet > i.o_facet_remove");
                if(!filters) {
                    return;
                }
                for (const filter of filters) {
                    await triggerClick(filter, filter);
                }
            }

            async function click_views() {
                const views = document.querySelectorAll("nav.o_cp_switch_buttons > button.o_switch_view:not(.active)");
                if(!views) {
                    return;
                }
                for (const view of views) {
                    await triggerClick(view, view);
                    await sleep(250);
                }
            }

            async function click_list_view() {
                const list_view = document.querySelector("nav.o_cp_switch_buttons > button.o_switch_view.o_list");
                if (!list_view) {
                    return;
                }
                await triggerClick(list_view, list_view);
                await sleep(250);
            }

            async function test_menu() {
                await click_views();
                await click_list_view();
                await remove_filters();
                await click_form_view();
            }

            async function test_all_menus() {
                
                menuIndex = 0;
                subMenuIndex = 0;
                await sleep(3000);

                const menus = document.querySelectorAll("div.o_menu_sections > div.dropdown > button.dropdown-toggle, div.o_menu_sections > a.dropdown-item");

                for (const menu of menus) {
                    await triggerClick(menu, menu);
                    await sleep(250);

                    const sub_menus = document.querySelectorAll("div.o_menu_sections > div.dropdown > div.dropdown-menu > a.dropdown-item");
                    for (const sub_menu of sub_menus) {
                        await triggerClick(sub_menu, sub_menu);
                        await sleep(1000);

                        await test_menu();
                    }
                }
                console.log('test successful');
            }

            test_all_menus()
        """
        urls = generate_backend_urls(self)
        t0 = time.time()
        for url, app_name in urls:
            with self.subTest(f'{app_name} @{url}'):
                self.browser_js(url, code, "odoo.isReady === true", login="admin", watch=True)
                self.terminate_browser()
        count = len(urls)
        duration = time.time() - t0
        _logger.runbot("admin crawled %s urls in %.2fs", count, duration)
        