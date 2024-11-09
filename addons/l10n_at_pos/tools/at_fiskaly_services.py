import logging
import uuid
import requests
import json
from odoo.exceptions import RedirectWarning, ValidationError
from datetime import datetime
from odoo.tools.float_utils import float_repr
from odoo import _
_logger = logging.getLogger(__name__)


COUNTRY_CODE_MAP = {
    "BD": "BGD", "BE": "BEL", "BF": "BFA", "BG": "BGR", "BA": "BIH", "BB": "BRB", "WF": "WLF", "BL": "BLM", "BM": "BMU",
    "BN": "BRN", "BO": "BOL", "BH": "BHR", "BI": "BDI", "BJ": "BEN", "BT": "BTN", "JM": "JAM", "BV": "BVT", "BW": "BWA",
    "WS": "WSM", "BQ": "BES", "BR": "BRA", "BS": "BHS", "JE": "JEY", "BY": "BLR", "BZ": "BLZ", "RU": "RUS", "RW": "RWA",
    "RS": "SRB", "TL": "TLS", "RE": "REU", "TM": "TKM", "TJ": "TJK", "RO": "ROU", "TK": "TKL", "GW": "GNB", "GU": "GUM",
    "GT": "GTM", "GS": "SGS", "GR": "GRC", "GQ": "GNQ", "GP": "GLP", "JP": "JPN", "GY": "GUY", "GG": "GGY", "GF": "GUF",
    "GE": "GEO", "GD": "GRD", "GB": "GBR", "GA": "GAB", "SV": "SLV", "GN": "GIN", "GM": "GMB", "GL": "GRL", "GI": "GIB",
    "GH": "GHA", "OM": "OMN", "TN": "TUN", "JO": "JOR", "HR": "HRV", "HT": "HTI", "HU": "HUN", "HK": "HKG", "HN": "HND",
    "HM": "HMD", "VE": "VEN", "PR": "PRI", "PS": "PSE", "PW": "PLW", "PT": "PRT", "SJ": "SJM", "PY": "PRY", "IQ": "IRQ",
    "PA": "PAN", "PF": "PYF", "PG": "PNG", "PE": "PER", "PK": "PAK", "PH": "PHL", "PN": "PCN", "PL": "POL", "PM": "SPM",
    "ZM": "ZMB", "EH": "ESH", "EE": "EST", "EG": "EGY", "ZA": "ZAF", "EC": "ECU", "IT": "ITA", "VN": "VNM", "SB": "SLB",
    "ET": "ETH", "SO": "SOM", "ZW": "ZWE", "SA": "SAU", "ES": "ESP", "ER": "ERI", "ME": "MNE", "MD": "MDA", "MG": "MDG",
    "MF": "MAF", "MA": "MAR", "MC": "MCO", "UZ": "UZB", "MM": "MMR", "ML": "MLI", "MO": "MAC", "MN": "MNG", "MH": "MHL",
    "MK": "MKD", "MU": "MUS", "MT": "MLT", "MW": "MWI", "MV": "MDV", "MQ": "MTQ", "MP": "MNP", "MS": "MSR", "MR": "MRT",
    "IM": "IMN", "UG": "UGA", "TZ": "TZA", "MY": "MYS", "MX": "MEX", "IL": "ISR", "FR": "FRA", "IO": "IOT", "SH": "SHN",
    "FI": "FIN", "FJ": "FJI", "FK": "FLK", "FM": "FSM", "FO": "FRO", "NI": "NIC", "NL": "NLD", "NO": "NOR", "NA": "NAM",
    "VU": "VUT", "NC": "NCL", "NE": "NER", "NF": "NFK", "NG": "NGA", "NZ": "NZL", "NP": "NPL", "NR": "NRU", "NU": "NIU",
    "CK": "COK", "XK": "XKX", "CI": "CIV", "CH": "CHE", "CO": "COL", "CN": "CHN", "CM": "CMR", "CL": "CHL", "CC": "CCK",
    "CA": "CAN", "CG": "COG", "CF": "CAF", "CD": "COD", "CZ": "CZE", "CY": "CYP", "CX": "CXR", "CR": "CRI", "CW": "CUW",
    "CV": "CPV", "CU": "CUB", "SZ": "SWZ", "SY": "SYR", "SX": "SXM", "KG": "KGZ", "KE": "KEN", "SS": "SSD", "SR": "SUR",
    "KI": "KIR", "KH": "KHM", "KN": "KNA", "KM": "COM", "ST": "STP", "SK": "SVK", "KR": "KOR", "SI": "SVN", "KP": "PRK",
    "KW": "KWT", "SN": "SEN", "SM": "SMR", "SL": "SLE", "SC": "SYC", "KZ": "KAZ", "KY": "CYM", "SG": "SGP", "SE": "SWE",
    "SD": "SDN", "DO": "DOM", "DM": "DMA", "DJ": "DJI", "DK": "DNK", "VG": "VGB", "DE": "DEU", "YE": "YEM", "DZ": "DZA",
    "US": "USA", "UY": "URY", "YT": "MYT", "UM": "UMI", "LB": "LBN", "LC": "LCA", "LA": "LAO", "TV": "TUV", "TW": "TWN",
    "TT": "TTO", "TR": "TUR", "LK": "LKA", "LI": "LIE", "LV": "LVA", "TO": "TON", "LT": "LTU", "LU": "LUX", "LR": "LBR",
    "LS": "LSO", "TH": "THA", "TF": "ATF", "TG": "TGO", "TD": "TCD", "TC": "TCA", "LY": "LBY", "VA": "VAT", "VC": "VCT",
    "AE": "ARE", "AD": "AND", "AG": "ATG", "AF": "AFG", "AI": "AIA", "VI": "VIR", "IS": "ISL", "IR": "IRN", "AM": "ARM",
    "AL": "ALB", "AO": "AGO", "AQ": "ATA", "AS": "ASM", "AR": "ARG", "AU": "AUS", "AT": "AUT", "AW": "ABW", "IN": "IND",
    "AX": "ALA", "AZ": "AZE", "IE": "IRL", "ID": "IDN", "UA": "UKR", "QA": "QAT", "MZ": "MOZ"
}

def generate_custom_uuidv4():
    raw_uuid = uuid.uuid4()
    uuid_str = str(raw_uuid)

    # Modify the 13th character to make sure it's a 4 (UUID version 4)
    uuid_str = uuid_str[:14] + '4' + uuid_str[15:]
    # Modify the 17th character to ensure it follows [89ab] (variant 1)
    variant_char = uuid_str[19]
    valid_variant = '89ab'[int(variant_char, 16) % 4]  # Map the character to 8, 9, a, or b
    uuid_str = uuid_str[:19] + valid_variant + uuid_str[20:]

    return uuid_str

def organization_config_updates(self, vals):
    """Send company as self this will update the company configuration at fiskaly"""
    if self.l10n_at_fiskaly_access_tocken and 'l10n_at_yearly_receipt_validation' in vals or 'l10n_at_monthly_receipt_validation' in vals:
        endpoint = '/api/v1/configuration'
        data = {
            "yearly_receipt_validation_enabled": self.l10n_at_yearly_receipt_validation,
            "monthly_receipt_validation_enabled": self.l10n_at_monthly_receipt_validation
        }
        response = _make_api_request(self, endpoint, "PATCH", data=data)

def _authenticate_fon_credentials(self):
    """Send company as self this will authenticate the company at FON"""
    if self.l10n_at_fon_participan_id and self.l10n_at_fon_user_id and self.l10n_at_fon_user_pin:
        endpoint = '/api/v1/fon/auth'
        fon_data = {
            "fon_participant_id": self.l10n_at_fon_participan_id,
            "fon_user_id": self.l10n_at_fon_user_id,
            "fon_user_pin": self.l10n_at_fon_user_pin,
        }
        fon_auth_response = _make_api_request(self, endpoint, "PUT", data=fon_data)
        if fon_auth_response.status_code == 200:
            self.is_fon_authenticated = True
        else:
            raise UserError(_("FON Authentication failed."))
    else:
        raise UserError(_("Please fill all fon required credentials before authenticating."))

def _authenticate_fiskaly_credentials(self):
    """
    Make an api call to authenticate credentials of fiskaly.
    pass company as self
    """
    if self.l10n_at_fiskaly_api_key and self.l10n_at_fiskaly_api_secret:
        try:
            access_url = 'https://rksv.fiskaly.com/api/v1/auth'
            headers = {'Content-Type': 'application/json'}
            data = {
                "api_key": self.l10n_at_fiskaly_api_key,
                "api_secret": self.l10n_at_fiskaly_api_secret,
            }
            response = requests.request("POST", access_url, headers=headers, json=data, timeout=10)
            print(response)
            if response.status_code == 200:
                response_json = response.json()
                self.l10n_at_fiskaly_access_tocken = response_json['access_token']
                self.l10n_at_fiskaly_organization_id = response_json['access_token_claims']['organization_id']
            return response
        except requests.exceptions.ConnectionError as error:
            _logger.warning('Connection Error: %r with the given URL %r', error, access_url)
            return {'errors': {'timeout': 'Cannot reach the server. Please try again later.'}}
        except json.decoder.JSONDecodeError as error:
            _logger.warning('JSONDecodeError: %r', error)
            return {'errors': {'JSONDecodeError': str(error)}}
    else:
        raise UserError(_("Some credentials are missing."))

def _make_api_request(self, endpoint, method='POST', data=None):
        """
        Make an api call, return response for multiple api requests of urban piper.
        send company as self
        """
        access_url = 'https://rksv.fiskaly.com' + endpoint
        try:
            headers = {
                'Authorization': f'Bearer {self.l10n_at_fiskaly_access_tocken}',
                'Content-Type': 'application/json'
            }
            print(method, access_url, headers, data)
            response = requests.request(method, access_url, headers=headers, json=data, timeout=10)
            print(response, response.json())
            if response.json().get('error','') == 'Unauthorized':
                # self._authenticate_fiskaly_credentials()
                # self._make_api_request(endpoint, method='POST', data=None, timeout=10)
                msg = _("Unauthorized, Please try again after authenticating your fiskaly credentials again")
                action = self.env.ref('base.action_res_company_form').with_context(res_id=self.id, view_mode = 'form')
                raise RedirectWarning(msg, action.id, _("Company profile"))
            return response
        except requests.exceptions.ConnectionError as error:
            _logger.warning('Connection Error: %r with the given URL %r', error, access_url)
            return {'errors': {'timeout': 'Cannot reach the server. Please try again later.'}}
        except json.decoder.JSONDecodeError as error:
            _logger.warning('JSONDecodeError: %r', error)
            return {'errors': {'JSONDecodeError': str(error)}}

def _create_scu(self, unique_uuid):
    """
    Make an api call, to create a security pupose signature craetion unit
    self: res.company()
    """
    endpoint = '/api/v1/signature-creation-unit/' + unique_uuid
    data = {
        "legal_entity_id": {
            "vat_id": self.vat
        },
        "legal_entity_name": "TEST ENTITY",
    }
    response = _make_api_request(self, endpoint, "PUT", data=data)
    if response.status_code != 200:
        raise ValidationError(_("There ara some issues while creating new SCU."))

def _create_register(self, unique_code):
    """
    Make an api call, to create a cash register,
    this function will create and register the register to FON
    this is also session based call pass session as self
    """
    endpoint = '/api/v1/cash-register/' + unique_code
    created_register_res = _make_api_request(self.company_id, endpoint, "PUT", data={})
    if created_register_res.status_code != 200:
        raise ValidationError(_("There ara some issues while creating new Cash register."))
    else:
        endpoint = '/api/v1/cash-register/' + unique_code
        register_response = _make_api_request(self.company_id, endpoint, "PATCH", data={"state": "REGISTERED"})
        if register_response.status_code != 200:
            raise ValidationError(_("Unable to register newly created register at fiskaly"))

def scu_state_update(self, new_state, unique_code):
    """compay as self"""
    endpoint = '/api/v1/signature-creation-unit/' + unique_code
    scu_initialize_response = _make_api_request(self, endpoint, "PATCH", data={"state": new_state})
    if scu_initialize_response.status_code != 200:
        raise ValidationError(_("Unable to update SCU state at fiskaly"))

def cash_reg_state_update(self, new_state):
    endpoint = '/api/v1/cash-register/' + self.l10n_at_pos_session_uuid
    register_initialize_response = _make_api_request(self.company_id, endpoint, "PATCH", data={"state": new_state})
    if register_initialize_response.status_code != 200:
        raise ValidationError(_(f"Unable to initialize newly created register at fiskaly for {self.name}"))

def sign_order_receipt(self, vat_details, session_id, receipt_type):
    """
    Make an api call, to sign a receipt,
    this function will create & sign a receipt
    self: pos.order() (single order)
    """
    receipt_data = {"receipt_type": receipt_type, "schema": {"ekabs_v0": {}}}
    company = self.company_id
    buyer = self.partner_id
    head_data = {
        "id": str(self.id),
        "number": str(self.tracking_number),
        "date": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "seller": {
            "name": company.name,
            "tax_number": company.vat,
            "tax_exemption": False,
            "address": {
                "street": company.street or '' + company.street2 or '',
                "postal_code": company.zip,
                "city": company.city,
                "country_code": COUNTRY_CODE_MAP[company.country_code]
            }
        },
        "buyer": {
            "name": buyer.name,
            "address": {
                "street": buyer.street or '' + buyer.street2 or '',
                "postal_code": buyer.zip,
                "city": buyer.city,
                "country_code": COUNTRY_CODE_MAP[buyer.country_code]
            }
        }
    }

    order_data = {
        "currency": self.currency_id.name,
        "full_amount_incl_vat": float_repr(self.amount_total, 2),
        "payment_types": [
            {
                "name": payment.payment_method_id.name,
                "amount": payment.amount
            }
            for payment in self.payment_ids
        ],
        "vat_amounts": [
            {
                "vat_rate": "STANDARD",
                "percentage": float_repr(((a["incl_vat"] - a["excl_vat"])/a["excl_vat"])*100, 2),
                "incl_vat": float_repr(a["incl_vat"], 2),
                "excl_vat": float_repr(a["excl_vat"], 2),
                "vat": float_repr(a["incl_vat"] - a["excl_vat"], 2),
            }
            for a in vat_details
        ],
        "lines": [
            {
                "text": line.product_id.name,
                "additional_text": ", ".join(
                    attr.display_name for attr in line.attribute_value_ids
                ),
                "vat_amounts": [
                    {
                        "percentage": float_repr(((line.price_subtotal_incl - line.price_subtotal)/line.price_subtotal)*100, 2) if line.price_subtotal else 0,
                        "incl_vat": line.price_subtotal_incl
                    }
                ],
                "item": {
                    "number": line.product_id.id,
                    "quantity": line.qty,
                    "price_per_unit": line.price_unit
                },
            }
            for line in self.lines
        ]
    }
    receipt_data["schema"]["ekabs_v0"]["head"] = head_data
    receipt_data["schema"]["ekabs_v0"]["data"] = order_data
    session = self.env['pos.session'].browse(session_id)
    self.l10n_at_pos_order_receipt_id = generate_custom_uuidv4()
    endpoint = '/api/v1/cash-register/' + session.l10n_at_pos_session_uuid + '/receipt/' + self.l10n_at_pos_order_receipt_id
    response = _make_api_request(self.company_id, endpoint, "PUT", data=receipt_data)
    # storing data in the order fields
    if response.status_code ==200:
        self.l10n_at_pos_order_receipt_qr_data = self._generate_qr_code_image(response.json().get('qr_code_data'))
        self.l10n_at_pos_order_receipt_number = int(response.json().get('receipt_number'))
        # If not signed the receipt that will be reflected on the receipts but don't stop the flow
        self.is_fiskaly_order_receipt_signed = bool(response.json().get('signed'))

def session_dep_report(self, starting_param_val, ending_param_val):
    report_data={"session_reports":[]}
    for session in self:
        if session.l10n_at_pos_session_uuid:
            endpoint = (
                f"/api/v1/cash-register/{session.l10n_at_pos_session_uuid}/export"
                f"?start_time_signature={starting_param_val}&end_time_signature={ending_param_val}"
            )

            audit_report_response = _make_api_request(session.company_id, endpoint, "GET")
            audit_report_response = audit_report_response.json()
            # Check for errors in the response
            if not audit_report_response or audit_report_response.get('error'):
                error_message = audit_report_response.get('error', {}).get('message', _('Unknown Error'))
                raise ValueError(_("Error while reporting sessions"))
            # Prepare the data for the report
            report_data["session_reports"].append({session.name: audit_report_response})

    # Return the report action
    return self.env.ref('l10n_at_pos.fiskaly_session_report').report_action(self, data=report_data)
