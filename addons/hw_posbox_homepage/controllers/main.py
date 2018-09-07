# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import os
import json
import jinja2
import subprocess
import socket
import sys
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

if hasattr(sys, 'frozen'):
    # When running on compiled windows binary, we don't have access to package loader.
    path = os.path.realpath(os.path.join(os.path.dirname(__file__), '..', 'views'))
    loader = jinja2.FileSystemLoader(path)
else:
    loader = jinja2.PackageLoader('odoo.addons.hw_posbox_homepage', "views")

env = jinja2.Environment(loader=loader, autoescape=True)
env.filters["json"] = json.dumps

homepage_template = env.get_template('homepage.html')
server_config_template = env.get_template('server_config.html')
wifi_config_template = env.get_template('wifi_config.html')

common_style = ""

def loading_block_ui(message):
    return "Loading"

class IoTboxHomepage(odoo.addons.web.controllers.main.Home):

    def get_ip_iotbox(self):
        interfaces = ni.interfaces()
        for iface_id in interfaces:
            iface_obj = ni.ifaddresses(iface_id)
            ifconfigs = iface_obj.get(ni.AF_INET, [])
            for conf in ifconfigs:
                if conf.get('addr') and conf.get('addr') != '127.0.0.1':
                    ips = conf.get('addr')
                    break
        return ips

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

        pos_device = self.get_pos_device_status()
        pos_device_status = []
        for status in pos_device:
            device = pos_device[status]
            status_class = "text-red"
            if device['status'] == 'connected':
                status_class = "text-green"
            elif device['status'] == 'connecting':
                status_class = "text-blue"
            pos_device_status.append({
                'status': device['status'],
                'status_class': status_class,
                'name': status,
                'message': ' '.join(device['messages'])
            })

        iot_device_status = []
        for device in hw_drivers.drivers:
            iot_device_status.append({
                'name': device,
                'message': str(hw_drivers.drivers[device].value)
            })

        return {
            'hostname': hostname,
            'ip': self.get_ip_iotbox(),
            'mac': ":".join(i + next(h) for i in h),
            'pos_device_status': pos_device_status,
            'iot_device_status': hw_drivers.drivers,
            'server_status': self.get_server_status() or 'Not Configured',
            'wifi_status': ssid or 'Not Connected',
            }

    @http.route('/', type='http', auth='none')
    def index(self):
        return homepage_template.render(self.get_homepage_data())

    @http.route('/list_drivers', type='http', auth='none', website=True)
    def list_drivers(self):

        drivers_list = ''
        for driver in os.listdir("/home/pi/odoo/addons/hw_drivers/drivers"):
            if driver != '__pycache__':
                drivers_list +="""<tr><td>""" + driver + """</td></tr>"""

        html = """
        <!DOCTYPE HTML>
        <html>
            <head>
                <meta http-equiv="cache-control" content="no-cache" />
                <meta http-equiv="pragma" content="no-cache" />
                <title>Odoo's IoTBox - Drivers list</title>
                """ + common_style + """
            </head>
            <body>
                <div class="breadcrumb"><a href="/">Home</a> / <span>Drivers list</span></div>
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
                    <div class="text-center font-small" style="margin: 10px auto;">
                        You can clear the drivers list
                        <form style="display: inline-block;margin-left: 4px;" action='/drivers_clear'>
                            <input class="btn btn-sm" type="submit" value="Clear"/>
                        </form>
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

        return "<meta http-equiv='refresh' content='0; url=http://" + self.get_ip_iotbox() + ":8069/list_drivers'>"

    def get_wifi_essid(self):
        wifi_options = []
        try:
            f = open('/tmp/scanned_networks.txt', 'r')
            for line in f:
                line = line.rstrip()
                line = misc.html_escape(line)
                wifi_options.append(line)
            f.close()
        except IOError:
            _logger.warning("No /tmp/scanned_networks.txt")
        return wifi_options

    @http.route('/wifi', type='http', auth='none', website=True)
    def wifi(self):
        return wifi_config_template.render({
            'title': 'Wifi configuration',
            'breadcrumb': 'Configure Wifi',
            'loading_message': 'Connecting to Wifi',
            'ssid': self.get_wifi_essid(),
        })

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
        res_payload = {
            'message': 'Connecting to ' + essid,
        }
        if server:
            res_payload['server'] = {
                'url': server,
                'message': 'Redirect to Odoo Server'
            }

        return json.dumps(res_payload)

    @http.route('/wifi_clear', type='http', auth='none', cors='*', csrf=False)
    def clear_wifi_configuration(self):
        os.system('/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/clear_wifi_configuration.sh')

        return "<meta http-equiv='refresh' content='0; url=http://" + self.get_ip_iotbox() + ":8069'>"

    @http.route('/server_clear', type='http', auth='none', cors='*', csrf=False)
    def clear_server_configuration(self):
        os.system('/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/clear_server_configuration.sh')

        return "<meta http-equiv='refresh' content='0; url=http://" + self.get_ip_iotbox() + ":8069'>"

    @http.route('/drivers_clear', type='http', auth='none', cors='*', csrf=False)
    def clear_drivers_list(self):
        os.system('/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/clear_drivers_list.sh')

        return "<meta http-equiv='refresh' content='0; url=http://" + self.get_ip_iotbox() + ":8069/list_drivers'>"

    @http.route('/server_connect', type='http', auth='none', cors='*', csrf=False)
    def connect_to_server(self, url, iotname):
        from odoo.addons.hw_drivers.controllers.load_drivers import load_uuid
        maciotbox = subprocess.check_output("/sbin/ifconfig eth0 |grep -Eo ..\(\:..\){5}", shell=True).decode('utf-8').split('\n')[0]
        token = 'token'
        maciotbox = 'macaddress'
        load_uuid(url.strip(' '), maciotbox, token)
        subprocess.call(['/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/connect_to_server.sh', url.strip(' '), iotname])

        return 'http://' + self.get_ip_iotbox() + ':8069'

    @http.route('/steps', type='http', auth='none', cors='*', csrf=False)
    def step_by_step_configure_page(self):
        return """
        <html>
            <head>
                <title>Configure IoT Box</title>
                """ + common_style + """
                <style>
                    .config-steps .title {
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    .progressbar {
                        counter-reset: step;
                        z-index: 1;
                        position: relative;
                        display: inline-block;
                        width: 100%;
                        padding: 0;
                    }
                    .progressbar li{
                        list-style-type: none;
                        float: left;
                        width: 33.33%;
                        position:relative;
                        text-align: center;
                        font-size: 0.8rem;
                    }
                    .progressbar li:before {
                        content:counter(step);
                        counter-increment: step;
                        height:30px;
                        width:30px;
                        line-height: 30px;
                        border: 2px solid #ddd;
                        display:block;
                        text-align: center;
                        margin: 0 auto 6px auto;
                        border-radius: 50%;
                        background-color: white;
                        color: #ddd;
                        font-size: 1rem;
                    }
                    .progressbar li:after {
                        content:'';
                        position: absolute;
                        width:100%;
                        height:2px;
                        background-color: #ddd;
                        top: 15px;
                        left: -50%;
                        z-index: -1;
                    }
                    .progressbar li:first-child:after {
                        content:none;
                    }
                    .progressbar li.active, .progressbar li.completed {
                        color:#875A7B;
                    }
                    .progressbar li:last-child:before {
                        content: '✔';
                    }
                    .progressbar li.active:before {
                        border-color:#875A7B;
                        color: #875A7B;
                    }
                    .progressbar li.completed:before{
                        border-color:#875A7B;
                        background-color:#875A7B;
                        color: #fff;
                    }
                    .progressbar li.completed + li:after{
                        background-color:#875A7B;
                    }
                    .footer-buttons {
                        display: inline-block;
                        width: 100%;
                        margin-top: 20px;
                    }
                </style>
                <script type="text/javascript" src="/web/static/lib/jquery/jquery.js"></script>
                <script>
                    $(document).ready(function () {
                        function changePage(key) {
                            $('.progressbar li[data-key=' + key + ']').prevAll().addClass('completed');
                            $('.progressbar li[data-key=' + key + ']').nextAll().removeClass('active completed');
                            $('.progressbar li[data-key=' + key + ']').addClass('active').removeClass('completed');
                            $('.config-steps.active').removeClass('active').addClass('o_hide');
                            $('.config-steps[data-key=' + key + ']').removeClass('o_hide').addClass('active');
                        }
                        $('.next-btn').on('click', function (ev) {
                            changePage($(ev.target).data('key'));
                        });
                        $('#config-form').submit(function(e){
                            e.preventDefault();
                            $('.loading-block').removeClass('o_hide');
                            $.ajax({
                                url:'/step_configure',
                                type:'post',
                                data:$('#config-form').serialize(),
                                success:function(){
                                    $('.loading-block').addClass('o_hide');
                                    changePage('done');
                                }
                            });
                        });
                    });
                </script>
            </head>
            <body>
                <div class="breadcrumb"><a href="/">Home</a> / <span>Configure IoTBox</span></div>
                <div class="container">
                    <h2 class="text-center">Configure IoT Box</h2>
                    <ul class="progressbar">
                        <li class="active" data-key="server">Configure Server</li>
                        <li data-key="wifi">Configure Wifi</li>
                        <li data-key="done">Done</li>
                    </ul>
                    <form id="config-form" style="margin-top: 20px;" action='/step_configure' method='POST'>
                        <div>
                            <div class="config-steps active" data-key="server">
                                <table align="center">
                                    <tr>
                                        <td>
                                            IoTBox Name
                                        </td>
                                        <td>
                                            <input type="text" name="iotname">
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
                                </table>
                                <div class="footer-buttons">
                                    <a class="btn next-btn" style="float: right" data-key="wifi">Next</a>
                                </div>
                            </div>
                            <div class="config-steps wifi-step o_hide" data-key="wifi">
                                <table align="center">
                                    <tr>
                                        <td>
                                            ESSID
                                        </td>
                                        <td>
                                            <select name="essid">
                                                """ + self.get_wifi_essid_option() + """
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
                                </table>
                                <div class="footer-buttons">
                                    <a class="btn next-btn" data-key="server">Previous</a>
                                    <input class="btn" style="float: right" type="submit" value="Submit"/>
                                </div>
                            </div>
                            <div class="config-steps o_hide" data-key="done">
                                <h3 class="text-center" style="margin: 0;">✔ Nice! Your configuration is done.</h3>
                                <div class="footer-buttons">
                                    <a class="btn" href="/" style="float: right">Done</a>
                                </div>
                            </div>
                        </div>
                    </form>
                    """ + loading_block_ui('Configuring your IoT Box') + """
                </div>
            </body>
        </html>
        """

    @http.route('/step_configure', type='http', auth='none', cors='*', csrf=False)
    def step_by_step_configure(self, url, iotname, essid, password, persistent=False):
        #call odoo server conf
        #call wifi conf
        import time
        time.sleep(3)
        return "Waiting and redirect page"

    # Set server address
    @http.route('/server', type='http', auth='none', website=True)
    def server(self):
        return server_config_template.render({
            'title': 'IoT -> Odoo server configuration',
            'breadcrumb': 'Configure Odoo Server',
            'hostname': subprocess.check_output('hostname').decode('utf-8'),
            'server_status': self.get_server_status() or 'Not configured yet',
            'loading_message': 'Configure Domain Server'
        })

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
