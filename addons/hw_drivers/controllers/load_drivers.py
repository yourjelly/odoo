import urllib3
import subprocess
import json

def load_uuid():

    maciotbox = subprocess.check_output("/sbin/ifconfig eth0 |grep -Eo ..\(\:..\){5}", shell=True).decode('utf-8').split('\n')[0]
    server = "" # read from file
    try:
        f = open('/home/pi/odoo-remote-server.conf', 'r')
        for line in f:
            server += line
        f.close()
    except: #In case the file does not exist
        server=''
    if server:
        data = {}
        server = server.split('\n')[0]
        url = server + '/iot/get_db_uuid'
        data['mac_address'] = maciotbox
        data['token']='token'
        data_json = json.dumps(data).encode('utf8')
        headers = {'Content-type': 'application/json', 'Accept': 'text/plain'}
        http = urllib3.PoolManager()
        try:
            req = http.request('POST',
                                url,
                                body=data_json,
                                headers=headers)
        except:
            logger.warning('Could not reach configured server')
    if req:
        db_uuid = json.loads(req.data.decode('utf-8'))['result']
        #if db_uuid create file with db_uuid and chmod read only root
        return db_uuid
    else:
        return "Server not reachable"

