# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import os
import subprocess
import socket
import werkzeug
import netifaces as ni
import odoo
from odoo import http
import requests
import zipfile
import io
import os
from odoo.tools import misc

from uuid import getnode as get_mac
from odoo.addons.hw_proxy.controllers import main as hw_proxy
from odoo.addons.hw_drivers.controllers import driver as hw_drivers

_logger = logging.getLogger(__name__)

common_style = """
    <style>
        body {
            width: 500px;
            margin: 30px auto;
            font-family: sans-serif;
            text-align: justify;
            color: #6B6B6B;
            background-color: #f1f1f1;
        }
        .text-green {
            color: #28a745;
        }
        .text-red {
            color: #dc3545;
        }
        .text-blue {
            color: #007bff;
        }
        .text-center {
            text-align: center;
        }
        .float-right {
            float: right;
        }
        .btn {
            display: inline-block;
            padding: 8px 15px;
            border: 1px solid #dadada;
            border-radius: 3px;
            font-weight: bold;
            font-size: 0.8rem;
            background: #fff;
            color: #00a09d;
            cursor: pointer;
        }
        .btn-sm {
            padding: 4px 8px;
            font-size: 0.7rem;
            font-weight: normal;
        }
        .btn:hover {
            background-color: #f1f1f1;
        }
        a {
            text-decoration: none;
            color: #00a09d;
        }
        a:hover {
            color: #006d6b;
        }
        .container {
            padding: 10px 20px;
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 1px 1px 0 rgba(0, 0, 0, 0.17);
        }
        .breadcrumb {
            margin-bottom: 10px;
            font-size: 0.9rem;
        }
        input[type="text"], input[type="password"] {
            padding: 6px 12px;
            font-size: 1rem;
            border: 1px solid #ccc;
            border-radius: 3px;
            color: inherit;
        }
        select {
            padding: 6px 12px;
            font-size: 1rem;
            border: 1px solid #ccc;
            border-radius: 3px;
            color: inherit;
            background: #ffffff;
            width: 100%;
        }
        .font-small {
            font-size: 0.8rem;
        }
        .loading-circle {
            display: inline-block;
            position: relative;
            width: 110px;
            height: 110px;
            margin: 25px;
        }
        .color1 {
            border-color: #875A7B !important;
        }
        .color2 {
            border-color: #006d6b !important;
        }
        .loading-circle div {
            position: absolute;
            border: 4px solid;
            opacity: 1;
            border-radius: 50%;
            animation: loading-circle 1s cubic-bezier(0, 0.2, 0.8, 1) infinite;
        }
        .loading-circle div:nth-child(2) {
            animation-delay: -0.5s;
        }
        @keyframes loading-circle {
            0% {
                top: 50px;
                left: 50px;
                width: 0;
                height: 0;
                opacity: 1;
            }
            100% {
                top: -1px;
                left: -1px;
                width: 100px;
                height: 100px;
                opacity: 0;
            }
        }
    </style>
"""


def get_homepage_html(data):
    home_style = common_style + """
        <style>
            table {
                width: 100%;
                border-collapse: collapse;
            }
            table tr {
                border-bottom: 1px solid #f1f1f1;
            }
            table tr:last-child {
                border-width: 0px;
            }
            table td {
                padding: 8px;
                border-left: 1px solid #f1f1f1;
            }
            table td:first-child {
                border-left: 0;
            }
            td.heading {
                font-weight: bold;
            }
            .footer {
                margin-top: 12px;
                text-align: right;
            }
            .footer a {
                margin-left: 8px;
            }
            .device-status {
                margin-bottom: 6px;
            }
            .device-status .message {
                font-size: 0.8rem;
            }
            .device-status .indicator {
                margin-left: 4px;
                font-size: 0.7rem;
                text-transform: uppercase;
            }
            .device-status .device {
                font-weight: 500;
            }
        </style>
    """

    def get_pos_device_status_html():
        pos_device = data['pos_device_status']
        if len(pos_device) == 0:
            return "No Device Found"
        status_html = ""
        for status in pos_device:
            device = pos_device[status]
            status_class = "text-red"
            if device['status'] == 'connected':
                status_class = "text-green"
            elif device['status'] == 'connecting':
                status_class = "text-blue"
            status_html += """
                <div class="device-status">
                    <span class="device">""" + status + """</span><span class="indicator """ + status_class + """ ">""" + device['status'] + """</span>
                    <div class="message"> """ + '\n'.join(device['messages']) + """</div>
                </div>
            """
        return status_html

    def get_iot_device_status_html():
        iot_device = data['iot_device_status']
        if len(iot_device) == 0:
            return "No Device Found"
        status_html = ""
        for path in iot_device:
            status_html += """
                <div class="device-status">
                    <span class="device">""" + path + """</span>
                    <div class="message"> """ + str(iot_device[path].value) + """</div>
                </div>
            """
        return status_html

    html = """
    <!DOCTYPE HTML>
    <html>
        <head>
            <meta http-equiv="cache-control" content="no-cache" />
            <meta http-equiv="pragma" content="no-cache" />
            <title>Odoo's IoTBox</title>
    """ + home_style + """
        </head>
        <body>
            <div class="container">
                <h2 class="text-center text-green">Your IoTBox is up and running</h2>
                <table align="center" cellpadding="3">
                    <tr>
                        <td class="heading">Name</td>
                        <td> """ + data['hostname'] + """ <a class="btn btn-sm float-right" href='/server'>configure</a></td>
                    </tr>
                    <tr>
                        <td class="heading">Version</td>
                        <td>V18.10 <a class="btn btn-sm float-right" href='/hw_proxy/upgrade/'>update</a></td>
                    </tr>
                    <tr>
                        <td class="heading">IP Address</td>
                        <td>""" + str(data['ip']) + """</a></td>
                    </tr>
                    <tr>
                        <td class="heading">Mac Address</td>
                        <td> """ + data['mac'] + """</td>
                    </tr>
                    <tr>
                        <td class="heading">WiFi</td>
                        <td>""" + data['wifi_status'] + """ <a class="btn btn-sm float-right" href='/wifi'>configure</a></td>
                    </tr>
                    <tr>
                        <td class="heading">Server</td>
                        <td><a href='""" + str(data['server_status']) + """' target=_blank>""" + data['server_status'] + """ <a class="btn btn-sm float-right" href='/server'>configure</a></td>
                    </tr>
                    <tr>
                        <td class="heading">POS Device</td>
                        <td>""" + get_pos_device_status_html() + """</td>
                    </tr>
                    <tr>
                        <td class="heading">IOT Device</td>
                        <td>""" + get_iot_device_status_html() + """ <a class="float-right" href='/list_drivers'>drivers list</a></td>
                    </tr>
                </table>
                <div style="margin: 20px auto 10px auto;" class="text-center">
                    <a class="btn" href='/point_of_sale/display'>POS Display</a>
                    <a class="btn" style="margin-left: 10px;" href='/remote_connect'>Remote Debug</a>
                </div>
            </div>
            <div class="footer">
                <a href='http://www.odoo.com/help'>Help</a>
                <a href='https://www.odoo.com/documentation/user/point_of_sale/posbox/index.html'>Manual</a>
            </div>
        </body>
    </html>

    """

    return html


class IoTboxHomepage(odoo.addons.web.controllers.main.Home):

    def get_hw_screen_message(self):
        return """
<p>
    The activate the customer display feature, you will need to reinstall the IoTBox software.
    You can find the latest images on the <a href="http://nightly.odoo.com/master/posbox/">Odoo Nightly builds</a> website.
    Make sure to download at least the version 16.<br/>
    Odoo version 11, or above, is required to use the customer display feature.
</p>
"""

    def get_pos_device_status(self):
        statuses = {}
        for driver in hw_proxy.drivers:
            statuses[driver] = hw_proxy.drivers[driver].get_status()
        return statuses

    def get_server_status(self):
        server_template = ""
        try:
            f = open('/home/pi/odoo-remote-server.conf', 'r')
            for line in f:
                server_template += line
            f.close()
        except:
            return False

        return server_template

    def get_homepage_data(self):
        hostname = str(socket.gethostname())
        mac = get_mac()
        h = iter(hex(mac)[2:].zfill(12))
        ssid = subprocess.check_output('iwconfig 2>&1 | grep \'ESSID:"\' | sed \'s/.*"\\(.*\\)"/\\1/\'', shell=True).decode('utf-8').rstrip()
        interfaces = ni.interfaces()
        for iface_id in interfaces:
            iface_obj = ni.ifaddresses(iface_id)
            ifconfigs = iface_obj.get(ni.AF_INET, [])
            for conf in ifconfigs:
                if conf.get('addr') and conf.get('addr') != '127.0.0.1':
                    ips = conf.get('addr')
                    break
        return {
            'hostname': hostname,
            'ip': ips,
            'mac': ":".join(i + next(h) for i in h),
            'pos_device_status': self.get_pos_device_status(),
            'iot_device_status': hw_drivers.drivers,
            'server_status': self.get_server_status() or 'Not Configured',
            'wifi_status': ssid or 'Not Connected'
        }

    @http.route('/', type='http', auth='none', website=True)
    def index(self):
        #return request.render('hw_posbox_homepage.index',mimetype='text/html')
        return get_homepage_html(self.get_homepage_data())

    @http.route('/list_drivers', type='http', auth='none', website=True)
    def list_drivers(self):

        drivers_list = ''
        for driver in os.listdir("/home/pi/odoo/addons/hw_drivers/drivers"):
            drivers_list +="""<tr><td>""" + driver + """</td></tr>"""

        html = """
        <!DOCTYPE HTML>
        <html>
            <head>
                <meta http-equiv="cache-control" content="no-cache" />
                <meta http-equiv="pragma" content="no-cache" />
                <title>Odoo's IoTBox - Drivers list</title>
                """ + home_style + """
            </head>
            <body>
                <div class="container">
                    <h2 class="text-center text-green">Drivers list</h2>
                    <table align="center" cellpadding="3">
                        <tr>
                            """ + drivers_list + """
                        </tr>
                    </table>
                    <div style="margin-top: 20px;" class="text-center">
                        <a class="btn" href='/load_drivers'>Load drivers</a>
                    </div>
                </div>
            </body>
        </html>

        """

        return html

    @http.route('/load_drivers', type='http', auth='none', website=True)
    def load_drivers(self):
        #récupérer fichier uuid
        db_uuid = ""
        try:
            f = open('/home/pi/uuid', 'r')
            for line in f:
                db_uuid += line
            f.close()
        except:
            return False

        subprocess.call("sudo mount -o remount,rw /", shell=True)
        subprocess.call("sudo mount -o remount,rw /root_bypass_ramdisks", shell=True)
        url = 'https://nightly.odoo.com/trunk/posbox/iotbox_drivers.zip'
        username = subprocess.check_output("/sbin/ifconfig eth0 |grep -Eo ..\(\:..\){5}", shell=True).decode('utf-8').split('\n')[0]
        response = requests.get(url, auth=(username, db_uuid.split('\n')[0]), stream=True)
        zip_file = zipfile.ZipFile(io.BytesIO(response.content))
        zip_file.extractall("/home/pi/odoo/addons/hw_drivers")
        subprocess.call("sudo mount -o remount,ro /", shell=True)
        subprocess.call("sudo mount -o remount,ro /root_bypass_ramdisks", shell=True)

        interfaces = ni.interfaces()
        for iface_id in interfaces:
            iface_obj = ni.ifaddresses(iface_id)
            ifconfigs = iface_obj.get(ni.AF_INET, [])
            for conf in ifconfigs:
                if conf.get('addr') and conf.get('addr') != '127.0.0.1':
                    ips = conf.get('addr')
                    break
        return "<meta http-equiv='refresh' content='15; url=http://" + ips + ":8069/list_drivers'>Drivers loaded refresh..."

    @http.route('/wifi', type='http', auth='none', website=True)
    def wifi(self):

        def get_wifi_essid_option():
            wifi_options = ""
            try:
                f = open('/tmp/scanned_networks.txt', 'r')
                for line in f:
                    line = line.rstrip()
                    line = misc.html_escape(line)
                    wifi_options += '<option value="' + line + '">' + line + '</option>\n'
                f.close()
            except IOError:
                _logger.warning("No /tmp/scanned_networks.txt")
            return wifi_options

        return """
<!DOCTYPE HTML>
<html>
    <head>
        <title>Wifi configuration</title>
""" + common_style + """
    </head>
    <body>
        <div class="breadcrumb"><a href="/">Home</a> / <span>Configure Wifi</span></div>
        <div class="container">
            <h2 class="text-center">Configure Wifi</h2>
            <p>
                Here you can configure how the iotbox should connect to wireless networks.
                Currently only Open and WPA networks are supported. When enabling the persistent checkbox,
                the chosen network will be saved and the iotbox will attempt to connect to it every time it boots.
            </p>
            <form action='/wifi_connect' method='POST'>
                <table align="center">
                    <tr>
                        <td>
                            ESSID
                        </td>
                        <td>
                            <select name="essid">
                                """ + get_wifi_essid_option() + """
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Password
                        </td>
                        <td>
                            <input type="password" name="password" placeholder="optional"/>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Persistent
                        </td>
                        <td>
                            <input type="checkbox" name="persistent"/>
                        </td>
                    </tr>
                    <tr>
                        <td/>
                        <td>
                            <input class="btn" type="submit" value="Connect"/>
                        </td>
                    </tr>
                </table>
            </form>
            <div class="text-center font-small" style="margin: 10px auto;">
                You can clear the persistent configuration
                <form style="display: inline-block;margin-left: 4px;" action='/wifi_clear'>
                    <input class="btn btn-sm" type="submit" value="Clear"/>
                </form>
            </div>
        </div>
    </body>
</html>
"""

    @http.route('/wifi_connect', type='http', auth='none', cors='*', csrf=False)
    def connect_to_wifi(self, essid, password, persistent=False):
        if persistent:
                persistent = "1"
        else:
                persistent = ""

        subprocess.call(['/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/connect_to_wifi.sh', essid, password, persistent])
        f = open('/home/pi/odoo-remote-server.conf', 'r')
        server = ""
        for line in f:
            server += line
        f.close()
        server = server.split('\n')[0]
        if server:
            return """
<html>
    <head> 
        """ + common_style + """
        <meta http-equiv='refresh' content='30; url=" """ + server + """'>
    </head>
    <body>
        <div class="container text-center">
            <h2>Connecting to """ + essid + """"</h2>
            <p><b>Redirect to Odoo server</b></p>
            <div class='loading-circle'>
                <div class='color1'></div><div class='color2'></div>
            </div>
        </div>
    </body>
</html>
"""
        else:
            return "Connecting to " + essid

    @http.route('/wifi_clear', type='http', auth='none', cors='*', csrf=False)
    def clear_wifi_configuration(self):
        os.system('/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/clear_wifi_configuration.sh')
        return "configuration cleared"

    @http.route('/server_connect', type='http', auth='none', cors='*', csrf=False)
    def connect_to_server(self, url, iotname):
        from odoo.addons.hw_drivers.controllers.load_drivers import load_uuid
        maciotbox = subprocess.check_output("/sbin/ifconfig eth0 |grep -Eo ..\(\:..\){5}", shell=True).decode('utf-8').split('\n')[0]
        token = 'token'
        load_uuid(url.strip(' '), maciotbox, token)
        subprocess.call(['/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/connect_to_server.sh', url.strip(' '), iotname])
        interfaces = ni.interfaces()
        for iface_id in interfaces:
            iface_obj = ni.ifaddresses(iface_id)
            ifconfigs = iface_obj.get(ni.AF_INET, [])
            for conf in ifconfigs:
                if conf.get('addr') and conf.get('addr') != '127.0.0.1':
                    ips = conf.get('addr')
                    break
        return """
<html>
    <head> 
        """ + common_style + """
        <meta http-equiv='refresh' content='30; url='http://""" + ips + """:8069'>
    </head>
    <body>
        <div class="container text-center">
            <h2>Configure Domain Server</h2>
            <p><b>Please wait...</b></p>
            <div class='loading-circle'>
                <div class='color1'></div><div class='color2'></div>
            </div>
        </div>
    </body>
</html>
    """

    @http.route('/step_configure', type='http', auth='none', cors='*', csrf=False)
    def step_by_step_configure(self, url, iotname, essid, password, persistent=False):
        #call odoo server conf
        #call wifi conf
        return "Waiting and redirect page"

    # Set server address
    @http.route('/server', type='http', auth='none', website=True)
    def server(self):

        hostname = subprocess.check_output('hostname').decode('utf-8')

        server_template = """
    <!DOCTYPE HTML>
    <html>
        <head>
            <title>IoT -> Odoo server configuration</title>
        """ + common_style + """
        </head>
        <body>
            <div class="breadcrumb"><a href="/">Home</a> / <span>Configure Odoo Server</span></div>
            <div class="container">
                <h2 class="text-center">Configure Odoo Server</h2>
                <p>
                    Here you can configure how the still hidden IoT sauce on your IoT infiltrated iotbox
                    can connect with the Odoo server.
                </p>
                <form action='/server_connect' method='POST'>
                    <table align="center">
                        <tr>
                            <td>
                                IoTBox Name
                            </td>
                            <td>
                                <input type="text" name="iotname" value=""" + hostname + """>
                            </td>
                        </tr>
                        <tr>
                            <td>
                                Server URL
                            </td>
                            <td>
                                <input type="text" name="url">
                            </td>
                        </tr>
                        <tr>
                            <td/>
                            <td>
                                <input class="btn" type="submit" value="Connect"/>
                            </td>
                        </tr>
                    </table>
                    <p class="text-center font-small">
                        Your current server <strong>""" + (self.get_server_status() or 'Not configured yet') + """</strong>
                    </p>
                </form>
            </div>
        </body>
    </html>
        """
        return server_template

    @http.route('/remote_connect', type='http', auth='none', cors='*')
    def remote_connect(self):
        ngrok_template = """
<!DOCTYPE HTML>
<html>
    <head>
        <title>Remote debugging</title>
        <script src="http://code.jquery.com/jquery-1.11.0.min.js"></script>
        <script>
           $(function () {
               var upgrading = false;
               $('#enable_debug').click(function () {
                   var auth_token = $('#auth_token').val();
                   if (auth_token == "") {
                       alert('Please provide an authentication token.');
                   } else {
                       $.ajax({
                           url: '/enable_ngrok',
                           data: {
                               'auth_token': auth_token
                           }
                       }).always(function (response) {
                           if (response === 'already running') {
                               alert('Remote debugging already activated.');
                           } else {
                               $('#auth_token').attr('disabled','disabled');
                               $('#enable_debug').html('Enabled remote debugging');
                               $('#enable_debug').removeAttr('href', '')
                               $('#enable_debug').off('click');
                           }
                       });
                   }
               });
           });
        </script>
""" + common_style + """
    </head>
    <body>
        <div class="breadcrumb"><a href="/">Home</a> / <span>Remote Debugging</span></div>
        <div class="container">
            <h2 class="text-center">Remote Debugging</h2>
            <p class='text-red'>
                This allows someone to gain remote access to your IoTbox, and
                thus your entire local network. Only enable this for someone
                you trust.
            </p>
            <div class='text-center'>
                <input type="text" id="auth_token" size="42" placeholder="Authentication Token"/> <br/>
                <a class="btn" style="margin: 18px auto;" id="enable_debug" href="#">Enable Remote Debugging</a>
            </div>
        </div>
    </body>
</html>
"""
        return ngrok_template

    @http.route('/enable_ngrok', type='http', auth='none', cors='*', csrf=False)
    def enable_ngrok(self, auth_token):
        if subprocess.call(['pgrep', 'ngrok']) == 1:
            subprocess.Popen(['ngrok', 'tcp', '-authtoken', auth_token, '-log', '/tmp/ngrok.log', '22'])
            return 'starting with ' + auth_token
        else:
            return 'already running'
