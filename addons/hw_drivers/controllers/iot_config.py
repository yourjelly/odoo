#!/usr/bin/python3

import subprocess
import netifaces as ni


class Server:
    @classmethod
    def get_hostname(cls):
        return subprocess.check_output('hostname').decode('utf-8').split('\n')[0]

    @classmethod
    def get_mac_address(cls):
        return subprocess.check_output("/sbin/ifconfig eth0 |grep -Eo ..\(\:..\){5}", shell=True).decode('utf-8').split('\n')[0]

    @classmethod
    def read_file_first_line(cls, filename):
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

    @classmethod
    def get_odoo_server_url(cls):
        return cls.read_file_first_line('odoo-remote-server.conf')

    @classmethod
    def get_token(cls):
        return cls.read_file_first_line('token')

    @classmethod
    def get_local_ip(cls):
        ip = ''
        for iface_id in ni.interfaces():
            iface_obj = ni.ifaddresses(iface_id)
            ifconfigs = iface_obj.get(ni.AF_INET, [])
            for conf in ifconfigs:
                if conf.get('addr') and conf.get('addr') != '127.0.0.1':
                    ip = conf.get('addr')
                    break
        return ip
