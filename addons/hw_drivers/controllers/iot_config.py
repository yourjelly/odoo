#!/usr/bin/python3

import socket
import netifaces


class Server:
    @classmethod
    def get_hostname(cls):
        return socket.gethostname()

    @classmethod
    def get_mac_address(cls):
        return netifaces.ifaddresses('eth0')[netifaces.AF_LINK][0]['addr']

    @classmethod
    def get_ip(cls):
        return netifaces.ifaddresses('eth0')[netifaces.AF_INET][0]['addr']

    @classmethod
    def get_ip_v6(cls):
        return netifaces.ifaddresses('eth0')[netifaces.AF_INET6][0]['addr']

    @classmethod
    def read_file_first_line(cls, filename):
        content = ""
        try:
            f = open('/home/pi/' + filename, 'r')
            content = f.readline().strip('\n')
            f.close()
        finally:
            return content

    @classmethod
    def get_odoo_server_url(cls):
        return cls.read_file_first_line('odoo-remote-server.conf')

    @classmethod
    def get_token(cls):
        return cls.read_file_first_line('token')
