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

upgrade_template = """
<!DOCTYPE HTML>
<html>
    <head>
        <title>Odoo's IoTBox - Software Upgrade</title>
        """ + common_style + """
        <script src="http://code.jquery.com/jquery-1.11.0.min.js"></script>
        <script>
        $(function(){
            var upgrading = false;
            $('#upgrade').click(function(){
                console.log('click');
                if(!upgrading){
                    upgrading = true;
                    $('#upgrade').text('Upgrading, Please Wait');
                    $.ajax({
                        url:'/hw_proxy/perform_upgrade/'
                    }).then(function(status){
                        $('#upgrade').html('Upgrade successful');
                        $('#upgrade').off('click');
                        $('#loading').html('<h3>Restarting the IoTBox...</h3>');
                        setTimeout(function(){
                            var cpt = 110;
                            setInterval(function(){
                                --cpt;
                                if(cpt==0){location.reload();}
                                $('#count').text(cpt);}
                                , 1000);
                            $('#page').html('<center><h3>Restarting the IoTBox...</h3>Time to refresh : <label id=count></label><br><div class="loading-circle"><div class="color1"></div><div class="color2"></div></div></center>');
                        }, 3000);
                    },function(){
                        $('#upgrade').text('Upgrade Failed');
                    });
                }
            });
        });
        </script>
        </style>
    </head>
    <body>
        <div class="breadcrumb"><a href="/">Home</a> / <span>IoT Box Software Upgrade</span></div>
        <div class="container" id="page">
            <h2 class="text-center">IoT Box Software Upgrade</h2>
            <p>
                This tool will help you perform an upgrade of the IoTBox's software over the internet.
                <p></p>
                However the preferred method to upgrade the IoTBox is to flash the sd-card with
                the <a href='http://nightly.odoo.com/trunk/posbox/'>latest image</a>. The upgrade
                procedure is explained into to the
                <a href='https://www.odoo.com/documentation/user/point_of_sale/posbox/index.html'>IoTBox manual</a>
            </p>
            <p>
                To upgrade the IoTBox, click on the upgrade button. The upgrade will take a few minutes. <b>Do not reboot</b> the IoTBox during the upgrade.
            </p>
            <p>
                Latest patch:
            </p>
            <pre style="margin: 0">
"""
upgrade_template += subprocess.check_output("git --work-tree=/home/pi/odoo/ --git-dir=/home/pi/odoo/.git log -1", shell=True).decode('utf-8').replace("\n", "<br/>")
upgrade_template += """
            </pre>
            <div class="text-center" style="margin-bottom: 15px;">
                <a class="btn" href='#' id='upgrade'>Upgrade</a>
                <div id='loading'></div>
            </div>
        <div>
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
