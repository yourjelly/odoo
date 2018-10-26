#!/usr/bin/python3

import subprocess
import re

from . import manager, driver
from . import iot_config
_server = iot_config.Server()


class NetworkManager(manager.MetaManager):
    _type = 'network'

    def scan(self):
        self._find_printers()

    def _get_driver(self, device_name, raw_data):
        driver_by_type = {
            'printer': NetworkPrinterDriver,
            'camera': CameraPrinterDriver,
        }

        type = raw_data.get('type')
        if type:
            return driver_by_type.get('type')
        else:
            return False

    def _find_printers(self):
        printers = subprocess.check_output("sudo lpinfo -lv", shell=True).decode('utf-8').split('Device')
        for printer in printers:
            printerTab = printer.split('\n')
            if printer and printerTab[4].split('=')[1] != ' ':
                device_connection = printerTab[1].split('= ')[1]

                model = ''
                for device_id in printerTab[4].split('= ')[1].split(';'):
                    if any(x in device_id for x in ['MDL', 'MODEL']):
                        model = device_id.split(':')[1]
                name = printerTab[2].split('= ')[1]
                serial = re.sub('[^a-zA-Z0-9 ]+', '', model).replace(' ', '_')
                identifier = ''

                device = {
                    'model': model,
                    'name': name,
                    'serial': serial,
                    'connection_type': device_connection,
                    'type': 'printer',
                }

                if device_connection == 'direct':
                    identifier = serial + '_' + _server.get_mac_address()
                elif device_connection == 'network' and 'socket' in printerTab[0]:
                    socketIP = printerTab[0].split('://')[1]
                    macprinter = subprocess.check_output("arp -a " + socketIP + " |awk NR==1'{print $4}'", shell=True).decode('utf-8').split('\n')[0]
                    identifier = macprinter  # macPRINTER

                    device['macprinter'] = macprinter

                elif device_connection == 'network' and 'dnssd' in printerTab[0]:
                    hostname_printer = subprocess.check_output("ippfind -n \"" + model + "\" | awk \'{split($0,a,\"/\"); print a[3]}\' | awk \'{split($0,b,\":\"); print b[1]}\'", shell=True).decode('utf-8').split('\n')[0]
                    if hostname_printer:
                        macprinter = subprocess.check_output("arp -a " + hostname_printer + " |awk NR==1'{print $4}'", shell=True).decode('utf-8').split('\n')[0]
                        identifier = macprinter  # macprinter
                        device['macprinter'] = macprinter
                        device['hostname'] = hostname_printer

                identifier = identifier.replace(':', '_')

                if identifier:
                    device['identifier'] = identifier
                    self._add_device(identifier, device)


class NetworkPrinterDriver(driver.MetaDriver):
    _type = 'printer'

    def __init__(self, identifier, connection_type, raw_data):
        super(NetworkPrinterDriver, self).__init__(identifier, connection_type, raw_data)
        self._model = raw_data.get('model')
        self._connection_type = raw_data.get('connection_type')

    def connect(self):
        self._install_driver()

    def _install_driver(self):
        cmd = "sudo lpadmin -p '" + self._name + "' -E -v '" + self._connection_type + "'"
        try:
            ppd = subprocess.check_output("sudo lpinfo -m |grep '" + self._model + "'", shell=True).decode('utf-8').split('\n')
            if len(ppd) > 2:
                subprocess.call(cmd, shell=True)
            else:
                subprocess.call(cmd + " -m '" + ppd[0].split(' ')[0] + "'", shell=True)
        except:
            subprocess.call(cmd, shell=True)

    def print(self, data):
        with open('/tmp/toprinter', 'w') as file:
            file.write(data)
        subprocess.call("cat /tmp/toprinter | base64 -d | lp -d " + self.name, shell=True)


class CameraPrinterDriver(driver.MetaDriver):
    _type = 'camera'

    def connect(self):
        self._install_driver()

    def _install_driver(self):
        pass
