from SimpleHTTPServer import SimpleHTTPRequestHandler
import psycopg2
from config import config
import SocketServer
import simplejson
import urlparse
import os
from os import curdir, sep
import mimetypes

class S(SimpleHTTPRequestHandler):

    def connect(self):
        return psycopg2.connect(database="KAP", user="postgres",host="localhost", password="123456", port="5432")

    def do_GET(self):
        mime = {"html":"text/html", "css":"text/css", "png":"image/png"}
        a = ""
        if a in mime.keys():
            self.send_response(200)
            self.send_header('Content-type', mime[a])
            self.end_headers()
            print a
            f = open(curdir + sep + self.path)             
            self.wfile.write(f.read())              
            f.close()
        return SimpleHTTPRequestHandler.do_GET(self)
        
    def do_POST(self):
        print "got post!!"
        content_len = int(self.headers.getheader('content-length', 0))
        post_body = self.rfile.read(content_len)
        dic=urlparse.parse_qs(post_body)
        print dic
        uname = dic["uname"][0]
        psw =  dic["psw"][0]
        self.insert_record(uname,psw)
        return self.wfile.write('<h1>Success!</h1>')

    def insert_record(self,username,password):
        conn = self.connect()
        print "Opened database successfully"
        cur = conn.cursor()
        query = "insert into data(uname,psw) values(%s,%s);"
        data = (username,password)
        cur.execute(query,data)
        conn.commit()
        print "Values entered successfully"
        conn.close()


def run(handler_class=S, port=80):
    httpd = SocketServer.TCPServer(("", port), handler_class)
    print 'Starting httpd...'
    httpd.serve_forever()

if __name__ == "__main__":
    from sys import argv

if len(argv) == 2:
    run(port=int(argv[1]))
else:
    run()