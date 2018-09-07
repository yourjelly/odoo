# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import os
import subprocess
import threading

from odoo import http

from odoo.addons.hw_proxy.controllers import main as hw_proxy

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
        .text-center {
            text-align: center;
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
        }
        .o_hide {
            display: none;
        }
        .loading-block {
            position: absolute;
            background-color: #0a060661;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 9999;
        }
        .loading-message-block {
            text-align: center;
            position: absolute;
            top: 50%;
            left: 50%;
            margin: -3% 0 0 -3%;
        }
        .loading-message {
            font-size: 14px;
            line-height: 20px;
            color:white
        }
        @keyframes spin {
            from {transform:rotate(0deg);}
            to {transform:rotate(360deg);}
        }
    </style>
"""

def loading_block_ui(message):
    return """
        <div class="loading-block o_hide">
            <div class="loading-message-block">
                <div style="height: 50px">
                    <img src="/web/static/src/img/spin.png" style="animation: spin 4s infinite linear;" alt="Loading...">
                </div>
                <br>
                <div class="loading-message">
                    <span class="message-title">Please wait..</span><br>
                    <span class="message-status">""" + message + """</span>
                </div>
            </div>
        </div>
    """

upgrade_template = """
<!DOCTYPE HTML>
<html>
    <head>
        <title>Odoo's IoTBox - Software Upgrade</title>
        """ + common_style + """
        <script type="text/javascript" src="/web/static/lib/jquery/jquery.js"></script>
        <script>
        $(function(){
            var upgrading = false;
            $('#upgrade').click(function(){
                if(!upgrading){
                    upgrading = true;
                    $('.loading-block').removeClass('o_hide');
                    $.ajax({
                        url:'/hw_proxy/perform_upgrade/'
                    }).then(function(status){
                        setTimeout(function () {
                        $('.message-title').text('Upgrade successful');
                        var cpt = 110;
                        setInterval(function(){
                            --cpt;
                            if(cpt==0){location.reload();}
                            $('.message-status').text('Restarting the IoTBox in ' + cpt);
                        } , 1000);
                        }, 3000);
                    },function(){
                        $('#upgrade').text('Upgrade Failed');
                    });
                }
            });
        });
        </script>
        <style>
            .commit-details {
                background: #f1f1f1;
                padding: 10px 10px 0 10px;
                border-radius: 5px;
            }
        </style>
    </head>
    <body>
        <div class="breadcrumb"><a href="/">Home</a> / <span>IoT Box Software Upgrade</span></div>
        <div class="container" id="page">
            <h2 class="text-center">IoT Box Software Upgrade</h2>
            <p>
                This tool will help you perform an upgrade of the IoTBox's software over the internet.
                However the preferred method to upgrade the IoTBox is to flash the sd-card with
                the <a href='http://nightly.odoo.com/trunk/posbox/'>latest image</a>. The upgrade
                procedure is explained into to the
                <a href='https://www.odoo.com/documentation/user/point_of_sale/posbox/index.html'>IoTBox manual</a>
            </p>
            <p>
                To upgrade the IoTBox, click on the upgrade button. The upgrade will take a few minutes. <b>Do not reboot</b> the IoTBox during the upgrade.
            </p>
            <div class="commit-details">
                <div style="padding-bottom: 5px; font-weight: bold;">
                    Latest patch:
                </div>
                <pre style="margin: 0">
""" + subprocess.check_output("git --work-tree=/home/pi/odoo/ --git-dir=/home/pi/odoo/.git log -1", shell=True).decode('utf-8').replace("\n", "<br/>") + """
                </pre>
            </div>
            <div class="text-center" style="margin: 15px auto;">
                <a class="btn" href='#' id='upgrade'>Upgrade</a>
            </div>
        <div>
        """ + loading_block_ui('Updating IoT box') + """
    </body>
</html>

"""

class PosboxUpgrader(hw_proxy.Proxy):
    def __init__(self):
        super(PosboxUpgrader,self).__init__()
        self.upgrading = threading.Lock()

    @http.route('/hw_proxy/upgrade', type='http', auth='none', )
    def upgrade(self):
        return upgrade_template 
    
    @http.route('/hw_proxy/perform_upgrade', type='http', auth='none')
    def perform_upgrade(self):
        self.upgrading.acquire()
        
        os.system('/home/pi/odoo/addons/point_of_sale/tools/posbox/configuration/posbox_update.sh')

        self.upgrading.release()
        return 'SUCCESS'
