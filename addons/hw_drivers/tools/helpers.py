# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import datetime
from importlib import util
import platform
import io
import json
import logging
import netifaces
from OpenSSL import crypto
import os
import sys
from pathlib import Path
import subprocess
import urllib3
import zipfile
from threading import Thread
import time

from odoo import _, http
from odoo.tools.func import lazy_property
from odoo.modules.module import get_resource_path

_logger = logging.getLogger(__name__)
nginx_process = None

#----------------------------------------------------------
# Helper
#----------------------------------------------------------


class IoTRestart(Thread):
    """
    Thread to restart odoo server in IoT Box when we must return a answer before
    """
    def __init__(self, delay):
        Thread.__init__(self)
        self.delay = delay

    def run(self):
        time.sleep(self.delay)
        os.execv(sys.executable, ['python'] + sys.argv)

def access_point():
    return get_ip() == '10.11.12.1'

def start_nginx_server():
    if platform.system() == 'Windows':
        path_list = os.listdir('../')
        path_nginx = next((path for path in path_list if 'nginx' in path), None)
        os.chdir('..\\%s' % path_nginx)
        _logger.info('Start Nginx server: ..\\%s\\nginx.exe' % path_nginx)
        os.popen('..\\%s\\nginx.exe' % path_nginx)
        os.chdir('..\\server')
    elif platform.system() == 'Linux':
        subprocess.check_call(["sudo", "service", "nginx", "restart"])

def check_certificate():
    """
    Check if the current certificate is up to date or not authenticated
    """
    server = get_odoo_server_url()
    if platform.system() == 'Windows':
        path = Path('odoo\\addons\\point_of_sale\\tools\\posbox\\overwrite_after_init\\etc\\ssl\\certs\\nginx-cert.crt')
    elif platform.system() == 'Linux':
        path = Path('/etc/ssl/certs/nginx-cert.crt')
    if server:
        if path.exists():
            with path.open('r') as f:
                cert = crypto.load_certificate(crypto.FILETYPE_PEM, f.read())
                cert_end_date = datetime.datetime.strptime(cert.get_notAfter().decode('utf-8'), "%Y%m%d%H%M%SZ") - datetime.timedelta(days=10)
                for key in cert.get_subject().get_components():
                    if key[0] == b'CN':
                        cn = key[1].decode('utf-8')
                if cn == 'OdooTempIoTBoxCertificate' or datetime.datetime.now() > cert_end_date:
                    _logger.info(_('Your certificate %s must be updated') % (cn))
                    load_certificate()
                else:
                    _logger.info(_('Your certificate %s is valid until %s') % (cn, cert_end_date))
        else:
            load_certificate()

def check_git_branch():
    """
    Check if the local branch is the same than the connected Odoo DB and
    checkout to match it if needed.
    """
    server = get_odoo_server_url()
    if server:
        urllib3.disable_warnings()
        http = urllib3.PoolManager(cert_reqs='CERT_NONE')
        try:
            response = http.request(
                'POST',
                server + "/web/webclient/version_info",
                body = '{}',
                headers = {'Content-type': 'application/json'}
            )

            if response.status == 200:
                git = ['git', '--work-tree=/home/pi/odoo/', '--git-dir=/home/pi/odoo/.git']

                db_branch = json.loads(response.data)['result']['server_serie'].replace('~', '-')
                if not subprocess.check_output(git + ['ls-remote', 'origin', db_branch]):
                    db_branch = 'master'

                local_branch = subprocess.check_output(git + ['symbolic-ref', '-q', '--short', 'HEAD']).decode('utf-8').rstrip()

                if db_branch != local_branch:
                    subprocess.call(["sudo", "mount", "-o", "remount,rw", "/"])
                    subprocess.check_call(["rm", "-rf", "/home/pi/odoo/addons/hw_drivers/iot_handlers/drivers/*"])
                    subprocess.check_call(["rm", "-rf", "/home/pi/odoo/addons/hw_drivers/iot_handlers/interfaces/*"])
                    subprocess.check_call(git + ['branch', '-m', db_branch])
                    subprocess.check_call(git + ['remote', 'set-branches', 'origin', db_branch])
                    os.system('/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/posbox_update.sh')
                    subprocess.call(["sudo", "mount", "-o", "remount,ro", "/"])
                    subprocess.call(["sudo", "mount", "-o", "remount,rw", "/root_bypass_ramdisks/etc/cups"])

        except Exception as e:
            _logger.error('Could not reach configured server')
            _logger.error('A error encountered : %s ' % e)

def check_image():
    """
    Check if the current image of IoT Box is up to date
    """
    url = 'https://nightly.odoo.com/master/iotbox/SHA1SUMS.txt'
    urllib3.disable_warnings()
    http = urllib3.PoolManager(cert_reqs='CERT_NONE')
    response = http.request('GET', url)
    checkFile = {}
    valueActual = ''
    for line in response.data.decode().split('\n'):
        if line:
            value, name = line.split('  ')
            checkFile.update({value: name})
            if name == 'iotbox-latest.zip':
                valueLastest = value
            elif name == get_img_name():
                valueActual = value
    if valueActual == valueLastest:
        return False
    version = checkFile.get(valueLastest, 'Error').replace('iotboxv', '').replace('.zip', '').split('_')
    return {'major': version[0], 'minor': version[1]}

def connect_server(url, token, db_uuid, enterprise_code):
    """
    Save config to connect IoT to the server
    """
    write_file('odoo-remote-server.conf', url)
    write_file('token', token)
    write_file('odoo-db-uuid.conf', db_uuid or '')
    write_file('odoo-enterprise-code.conf', enterprise_code or '')

def get_img_name():
    major, minor = get_version().split('.')
    return 'iotboxv%s_%s.zip' % (major, minor)

def get_ip():
    interfaces = netifaces.interfaces()
    for interface in interfaces:
        if netifaces.ifaddresses(interface).get(netifaces.AF_INET):
            addr = netifaces.ifaddresses(interface).get(netifaces.AF_INET)[0]['addr']
            if addr != '127.0.0.1': return addr

def get_mac_address():
    interfaces = netifaces.interfaces()
    for interface in interfaces:
        if netifaces.ifaddresses(interface).get(netifaces.AF_INET):
            addr = netifaces.ifaddresses(interface).get(netifaces.AF_LINK)[0]['addr']
            if addr != '00:00:00:00:00:00': return addr

def get_ssid():
    if platform.system() == 'Linux':
        ap = subprocess.call(['systemctl', 'is-active', '--quiet', 'hostapd']) # if service is active return 0 else inactive
        if not ap:
            return subprocess.check_output(['grep', '-oP', '(?<=ssid=).*', '/etc/hostapd/hostapd.conf']).decode('utf-8').rstrip()
        process_iwconfig = subprocess.Popen(['iwconfig'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        process_grep = subprocess.Popen(['grep', 'ESSID:"'], stdin=process_iwconfig.stdout, stdout=subprocess.PIPE)
        return subprocess.check_output(['sed', 's/.*"\\(.*\\)"/\\1/'], stdin=process_grep.stdout).decode('utf-8').rstrip()
    else:
        return 'ESSID'

def get_odoo_server_url():
    if platform.system() == 'Linux':
        ap = subprocess.call(['systemctl', 'is-active', '--quiet', 'hostapd']) # if service is active return 0 else inactive
        if not ap:
            return False
    return read_file_first_line('odoo-remote-server.conf')

def get_token():
    return read_file_first_line('token')

def get_version():
    if platform.system() == 'Linux':
        return subprocess.check_output(['cat', '/var/odoo/iotbox_version']).decode().rstrip()
    else:
        return 'W22_08'

def get_wifi_essid():
    wifi_options = []
    process_iwlist = subprocess.Popen(['sudo', 'iwlist', 'wlan0', 'scan'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    process_grep = subprocess.Popen(['grep', 'ESSID:"'], stdin=process_iwlist.stdout, stdout=subprocess.PIPE).stdout.readlines()
    for ssid in process_grep:
        essid = ssid.decode('utf-8').split('"')[1]
        if essid not in wifi_options:
            wifi_options.append(essid)
    return wifi_options

def load_certificate():
    """
    Send a request to Odoo with customer db_uuid and enterprise_code to get a true certificate
    """
    db_uuid = read_file_first_line('odoo-db-uuid.conf')
    enterprise_code = read_file_first_line('odoo-enterprise-code.conf')
    if db_uuid and enterprise_code:
        url = 'https://www.odoo.com/odoo-enterprise/iot/x509'
        data = {
            'params': {
                'db_uuid': db_uuid,
                'enterprise_code': enterprise_code
            }
        }
        urllib3.disable_warnings()
        http = urllib3.PoolManager(cert_reqs='CERT_NONE')
        response = http.request(
            'POST',
            url,
            body = json.dumps(data).encode('utf8'),
            headers = {'Content-type': 'application/json', 'Accept': 'text/plain'}
        )
        result = json.loads(response.data.decode('utf8'))['result']
        if result:
            write_file('odoo-subject.conf', result['subject_cn'])
            if platform.system() == 'Linux':
                subprocess.call(["sudo", "mount", "-o", "remount,rw", "/"])
                subprocess.call(["sudo", "mount", "-o", "remount,rw", "/root_bypass_ramdisks/"])
                Path('/etc/ssl/certs/nginx-cert.crt').write_text(result['x509_pem'])
                Path('/root_bypass_ramdisks/etc/ssl/certs/nginx-cert.crt').write_text(result['x509_pem'])
                Path('/etc/ssl/private/nginx-cert.key').write_text(result['private_key_pem'])
                Path('/root_bypass_ramdisks/etc/ssl/private/nginx-cert.key').write_text(result['private_key_pem'])
                subprocess.call(["sudo", "mount", "-o", "remount,ro", "/"])
                subprocess.call(["sudo", "mount", "-o", "remount,ro", "/root_bypass_ramdisks/"])
                subprocess.call(["sudo", "mount", "-o", "remount,rw", "/root_bypass_ramdisks/etc/cups"])
            elif platform.system() == 'Windows':
                path_list = os.listdir('../')
                path_nginx = next((path for path in path_list if 'nginx' in path), None)
                path = Path('..\\%s\\conf\\nginx-cert.crt' % path_nginx).write_text(result['x509_pem'])
                path = Path('..\\%s\\conf\\nginx-cert.key' % path_nginx).write_text(result['private_key_pem'])
            start_nginx_server()

def download_iot_handlers(auto=True):
    """
    Get the drivers from the configured Odoo server
    """
    server = get_odoo_server_url()
    if server:
        urllib3.disable_warnings()
        pm = urllib3.PoolManager(cert_reqs='CERT_NONE')
        server = server + '/iot/get_handlers'
        try:
            resp = pm.request('POST', server, fields={'mac': get_mac_address(), 'auto': auto})
            if resp.data:
                if platform.system() == 'Linux':
                    subprocess.call(["sudo", "mount", "-o", "remount,rw", "/"])
                drivers_path = ['odoo', 'addons', 'hw_drivers', 'iot_handlers']
                path = os.path.join(os.path.abspath(os.path.dirname(sys.argv[0])), *drivers_path)
                zip_file = zipfile.ZipFile(io.BytesIO(resp.data))
                zip_file.extractall(path)
                if platform.system() == 'Linux':
                    subprocess.call(["sudo", "mount", "-o", "remount,ro", "/"])
                    subprocess.call(["sudo", "mount", "-o", "remount,rw", "/root_bypass_ramdisks/etc/cups"])
        except Exception as e:
            _logger.error('Could not reach configured server')
            _logger.error('A error encountered : %s ' % e)

def load_iot_handlers():
    """
    This method loads local files: 'odoo/addons/hw_drivers/iot_handlers/drivers' and
    'odoo/addons/hw_drivers/iot_handlers/interfaces'
    And execute these python drivers and interfaces
    """
    for directory in ['interfaces', 'drivers']:
        path = get_resource_path('hw_drivers', 'iot_handlers', directory)
        filesList = list_file_by_os(os.listdir(path))
        for file in filesList:
            path_file = os.path.join(path, file)
            spec = util.spec_from_file_location(file, path_file)
            if spec:
                module = util.module_from_spec(spec)
                spec.loader.exec_module(module)
    lazy_property.reset_all(http.root)

def list_file_by_os(file_list):
    file_list_os = []
    platform_os = platform.system()
    for file in file_list:
        if platform_os == 'Linux' and file.split('.')[0][-1] == 'L':
            file_list_os.append(file)
        elif platform_os == 'Windows' and file.split('.')[0][-1] == 'W':
            file_list_os.append(file)
        elif file.split('.')[0][-1] not in ['L', 'W']:
            file_list_os.append(file)
    return file_list_os

def odoo_restart(delay):
    IR = IoTRestart(delay)
    IR.start()

def path_file(filename):
    return os.path.join(os.path.abspath(os.path.dirname(sys.argv[0])), filename)

def read_file_first_line(filename):
    path = path_file(filename)
    if os.path.exists(path):
        with open(path, 'r') as f:
            return f.readline().strip('\n')
    return ''

def unlink_file(filename):
    if platform.system() == 'Linux':
        subprocess.call(["sudo", "mount", "-o", "remount,rw", "/"])
    path = path_file(filename)
    if os.path.exists(path):
        os.remove(path)
    if platform.system() == 'Linux':
        subprocess.call(["sudo", "mount", "-o", "remount,ro", "/"])
        subprocess.call(["sudo", "mount", "-o", "remount,rw", "/root_bypass_ramdisks/etc/cups"])

def write_file(filename, text, mode='w'):
    if platform.system() == 'Linux':
        subprocess.call(["sudo", "mount", "-o", "remount,rw", "/"])
    path = path_file(filename)
    with open(path, mode) as f:
        f.write(text)
    if platform.system() == 'Linux':
        subprocess.call(["sudo", "mount", "-o", "remount,ro", "/"])
        subprocess.call(["sudo", "mount", "-o", "remount,rw", "/root_bypass_ramdisks/etc/cups"])
