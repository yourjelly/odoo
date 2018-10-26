#!/usr/bin/python3

import subprocess
import netifaces as ni


class Server:
    def get_hostname(self):
        return subprocess.check_output('hostname').decode('utf-8').split('\n')[0]

    def get_mac_address(self):
        return subprocess.check_output("/sbin/ifconfig eth0 |grep -Eo ..\(\:..\){5}", shell=True).decode('utf-8').split('\n')[0]

    def read_file_first_line(self, filename):
        content = ""
        try:
            f = open('/home/pi/' + filename, 'r')
            for line in f:
                content += line
                break
            f.close()
        finally:
            # content = content.split('\n')[0]
            return content

    def get_odoo_server_url(self):
        return self.read_file_first_line('odoo-remote-server.conf')

    def get_token(self):
        return self.read_file_first_line('token')

    def get_local_ip(self):
        ip = ''
        for iface_id in ni.interfaces():
            iface_obj = ni.ifaddresses(iface_id)
            ifconfigs = iface_obj.get(ni.AF_INET, [])
            for conf in ifconfigs:
                if conf.get('addr') and conf.get('addr') != '127.0.0.1':
                    ip = conf.get('addr')
                    break
        return ip
