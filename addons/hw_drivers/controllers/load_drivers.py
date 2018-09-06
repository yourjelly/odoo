import urllib3
import subprocess
import json

def load_uuid(server, maciotbox, token):

    data = {}
    url = server + '/iot/get_db_uuid'
    data['mac_address'] = maciotbox
    data['token'] = token
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
        if db_uuid:
            subprocess.call("echo " + db_uuid + " > uuid", shell=True)
            subprocess.call("chmod 600 uuid", shell=True)
            return db_uuid
        else:
            return "Unable to get UUID of database"
    else:
        return "Server not reachable"

