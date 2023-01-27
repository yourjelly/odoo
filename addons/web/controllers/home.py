# Part of Odoo. See LICENSE file for full copyright and licensing details.

import json
import logging

import odoo
import odoo.modules.registry
from odoo import http
from odoo.exceptions import AccessError
from odoo.http import request
from odoo.models import BaseModel
from odoo.service import security
from odoo.tools import ustr, safe_eval
from odoo.tools.translate import _
from .utils import ensure_db, _get_login_redirect_url, is_user_internal


_logger = logging.getLogger(__name__)


# Shared parameters for all login/signup flows
SIGN_UP_REQUEST_PARAMS = {'db', 'login', 'debug', 'token', 'message', 'error', 'scope', 'mode',
                          'redirect', 'redirect_hostname', 'email', 'name', 'partner_id',
                          'password', 'confirm_password', 'city', 'country_id', 'lang', 'signup_email'}
LOGIN_SUCCESSFUL_PARAMS = set()


class Home(http.Controller):

    @http.route('/', type='http', auth="none")
    def index(self, s_action=None, db=None, **kw):
        if request.session.uid and not is_user_internal(request.session.uid):
            return request.redirect_query('/web/login_successful', query=request.params)
        return request.redirect_query('/web', query=request.params)

    # ideally, this route should be `auth="user"` but that don't work in non-monodb mode.
    @http.route('/web', type='http', auth="none")
    def web_client(self, s_action=None, **kw):

        # Ensure we have both a database and a user
        ensure_db()
        if not request.session.uid:
            return request.redirect('/web/login', 303)
        if kw.get('redirect'):
            return request.redirect(kw.get('redirect'), 303)
        if not security.check_session(request.session, request.env):
            raise http.SessionExpiredException("Session expired")
        if not is_user_internal(request.session.uid):
            return request.redirect('/web/login_successful', 303)

        # Side-effect, refresh the session lifetime
        request.session.touch()

        # Restore the user on the environment, it was lost due to auth="none"
        request.update_env(user=request.session.uid)
        try:
            context = request.env['ir.http'].webclient_rendering_context()
            response = request.render('web.webclient_bootstrap', qcontext=context)
            response.headers['X-Frame-Options'] = 'DENY'
            return response
        except AccessError:
            return request.redirect('/web/login?error=access')

    # UnityReadFieldSpec = dict[str, Union[bool, 'UnityReadFieldSpec']]

    @http.route("/web/unity_read/<string:model>", type='json', auth='user')
    def unity_read(self, *args, **kwargs):
        env: odoo.api.Environment = request.env
        context: dict = kwargs["kwargs"]["context"]
        model: str = kwargs["model"]
        fields_spec: dict = kwargs["kwargs"]["fields"]
        read_params: dict = kwargs["kwargs"]["read"]
        records: odoo.models.BaseModel = env[model].with_context(context).browse(read_params["ids"])
        global_context_dict = {
            'active_ids': read_params["ids"],
            'active_model': records._name,
            'context': context,
        }

        return [Home._read_main(global_context_dict, fields_spec, record) for record in records]

    @http.route("/web/unity_search/<string:model>", type='json', auth='user')
    def unity_search(self, *args, **kwargs):
        env: odoo.api.Environment = request.env
        context: dict = kwargs["kwargs"]["context"]
        model: str = kwargs["model"]
        fields_spec: dict = kwargs["kwargs"]["fields"]
        read_params: dict = kwargs["kwargs"]["read"]
        records: odoo.models.BaseModel = env[model].with_context(context).search(read_params["domain"])

        global_context_dict = {
            'active_ids': read_params["ids"],
            'active_model': records._name,
            'context': context,
        }
        return [Home._read_main(global_context_dict, fields_spec, record) for record in records]

    @staticmethod
    def _read_x2many(global_context_dict, field_name, specification, record, record_raw, local_context_dict) -> list[dict]:
        assert record["id"] == record_raw["id"]
        if "__context" in specification:
            evaluated_context = safe_eval.safe_eval(specification["__context"], global_context_dict,
                                                    local_context_dict)
            print(
                f"[{field_name}] with context: {specification['__context']} has been evaluated to {evaluated_context}")
            x2many = record[field_name].with_context(**evaluated_context)
        else:
            x2many = record[field_name]
        return [Home._read_main(global_context_dict, specification, rec, record_raw) for rec in x2many]

    @staticmethod
    def _read_many2one(global_context_dict, field_name, specification, record, local_context_dict) -> list:
        if "__context" in specification:
            evaluated_context = safe_eval.safe_eval(specification["__context"], global_context_dict, local_context_dict)
            print(f"[{field_name}] with context: {specification['__context']} has been evaluated to {evaluated_context}")

            many2one_record = record[field_name].with_context(**evaluated_context)
        else:
            many2one_record = record[field_name]
        return record._fields[field_name].convert_to_read(many2one_record, record, use_name_get=True)

    @staticmethod
    def _read_main(global_context_dict, specification, record: BaseModel, parent_raw: dict = None) -> dict:
        record_result_raw: dict = \
        record._read_format([field for field in specification if not field.startswith("__")], load=None)[0]
        vals = {'id': record_result_raw['id']}
        local_context_dict = {
            'active_id': record['id'],
            **record_result_raw
        }
        for field_name, field_spec in specification.items():
            if field_name.startswith("__"):
                continue
            field = record._fields[field_name]
            if field_spec == 1:
                vals[field_name] = field.convert_to_read(record[field_name], record, use_name_get=True)
            else:
                if field.type == "many2one":
                    vals[field_name] = Home._read_many2one(global_context_dict, field_name, field_spec, record, local_context_dict) or False
                else:
                    assert field.type in ["many2many", "one2many"]
                    if parent_raw:
                        local_context_dict["parent"] = odoo.tools.DotDict(parent_raw)
                    vals[field_name] = Home._read_x2many(global_context_dict, field_name, field_spec, record, record_result_raw, local_context_dict)
        return vals

    def unity_group(self):
        """
        /web/untity_group/<string:model>

        {
            "model":str,
            "context":context without evaluation
                    {
                        "active_id": single id
                        "active_ids": multiple ids
                        "params":{
                            action_id: single id,
                            active_id: single id,
                            cids: "1,2,3" string of company ids
                            id: single id, I don't know what this is
                            menu_id:  single id, menu for the url
                            model: string: the current model
                            view_type: string: "form"
                        }
                        ...
                    }
            "domain" : domain, might have evaluation (like active ID)
        }


        """
        pass

    @http.route('/web/webclient/load_menus/<string:unique>', type='http', auth='user', methods=['GET'])
    def web_load_menus(self, unique):
        """
        Loads the menus for the webclient
        :param unique: this parameters is not used, but mandatory: it is used by the HTTP stack to make a unique request
        :return: the menus (including the images in Base64)
        """
        menus = request.env["ir.ui.menu"].load_web_menus(request.session.debug)
        body = json.dumps(menus, default=ustr)
        response = request.make_response(body, [
            # this method must specify a content-type application/json instead of using the default text/html set because
            # the type of the route is set to HTTP, but the rpc is made with a get and expects JSON
            ('Content-Type', 'application/json'),
            ('Cache-Control', 'public, max-age=' + str(http.STATIC_CACHE_LONG)),
        ])
        return response

    def _login_redirect(self, uid, redirect=None):
        return _get_login_redirect_url(uid, redirect)

    @http.route('/web/login', type='http', auth="none")
    def web_login(self, redirect=None, **kw):
        ensure_db()
        request.params['login_success'] = False
        if request.httprequest.method == 'GET' and redirect and request.session.uid:
            return request.redirect(redirect)

        # simulate hybrid auth=user/auth=public, despite using auth=none to be able
        # to redirect users when no db is selected - cfr ensure_db()
        if request.env.uid is None:
            if request.session.uid is None:
                # no user -> auth=public with specific website public user
                request.env["ir.http"]._auth_method_public()
            else:
                # auth=user
                request.update_env(user=request.session.uid)

        values = {k: v for k, v in request.params.items() if k in SIGN_UP_REQUEST_PARAMS}
        try:
            values['databases'] = http.db_list()
        except odoo.exceptions.AccessDenied:
            values['databases'] = None

        if request.httprequest.method == 'POST':
            try:
                uid = request.session.authenticate(request.db, request.params['login'], request.params['password'])
                request.params['login_success'] = True
                return request.redirect(self._login_redirect(uid, redirect=redirect))
            except odoo.exceptions.AccessDenied as e:
                if e.args == odoo.exceptions.AccessDenied().args:
                    values['error'] = _("Wrong login/password")
                else:
                    values['error'] = e.args[0]
        else:
            if 'error' in request.params and request.params.get('error') == 'access':
                values['error'] = _('Only employees can access this database. Please contact the administrator.')

        if 'login' not in values and request.session.get('auth_login'):
            values['login'] = request.session.get('auth_login')

        if not odoo.tools.config['list_db']:
            values['disable_database_manager'] = True

        response = request.render('web.login', values)
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['Content-Security-Policy'] = "frame-ancestors 'self'"
        return response

    @http.route('/web/login_successful', type='http', auth='user', website=True, sitemap=False)
    def login_successful_external_user(self, **kwargs):
        """Landing page after successful login for external users (unused when portal is installed)."""
        valid_values = {k: v for k, v in kwargs.items() if k in LOGIN_SUCCESSFUL_PARAMS}
        return request.render('web.login_successful', valid_values)

    @http.route('/web/become', type='http', auth='user', sitemap=False)
    def switch_to_admin(self):
        uid = request.env.user.id
        if request.env.user._is_system():
            uid = request.session.uid = odoo.SUPERUSER_ID
            # invalidate session token cache as we've changed the uid
            request.env['res.users'].clear_caches()
            request.session.session_token = security.compute_session_token(request.session, request.env)

        return request.redirect(self._login_redirect(uid))

    @http.route('/web/health', type='http', auth='none', save_session=False)
    def health(self):
        data = json.dumps({
            'status': 'pass',
        })
        headers = [('Content-Type', 'application/json'),
                   ('Cache-Control', 'no-store')]
        return request.make_response(data, headers)
