import threading
import json
from SimpleWebSocketServer import SimpleWebSocketServer, WebSocket

clients = {}
clientsAddress = {}
masterconnections = {}
class SimpleChat(WebSocket):

    def handleMessage(self):
      message = json.loads(self.data);
      print("message", message)

      userId = message['userId']
      if 'recipientId' in message:
        recipientId = message['recipientId']
      returnMessage = {}

      if 'masterwebsockte' in message:
        masterconnections[userId] = self
        returnMessage['onlineUsers'] = list(masterconnections.keys());
        for mc in masterconnections:
          clientsAddress[masterconnections[mc].address].sendMessage(str(returnMessage));
      elif 'initMessage' in message:
        if userId not in clients:
          clients[userId] = {}  
        clients[userId][recipientId] = self;
      elif 'typing' in message:
        if (recipientId in clients) and (userId in clients[recipientId]):
          recipientaddress = clients[recipientId][userId].address
          returnMessage['typing'] = True
          clientsAddress[recipientaddress].sendMessage(str(returnMessage))
      else:
        if (recipientId not in clients) or (userId not in clients[recipientId]):
          if recipientId in masterconnections:
            returnMessage['open'] = userId
            clientsAddress[masterconnections[recipientId].address].sendMessage(str(returnMessage))
        else:
          recipientaddress = clients[recipientId][userId].address
          returnMessage['message'] = message['message']
          clientsAddress[recipientaddress].sendMessage(str(returnMessage))

    def handleConnected(self):
      print(self.address, 'connected')
      clientsAddress[self.address] = self;

    def handleClose(self):
      print(self.address, 'closed')
      found = False
      returnMessage = {}

      del clientsAddress[self.address]
      for key in masterconnections:
        if masterconnections[key].address == self.address:
          del masterconnections[key]
          returnMessage['offlineUsers'] = key;
          for mc in masterconnections:
            clientsAddress[masterconnections[mc].address].sendMessage(str(returnMessage));
          found = True

      if not found:
        for cId in clients:
          for rId in clients[cId]:
            if clients[cId][rId].address == self.address:
              del clients[cId][rId]

server = SimpleWebSocketServer('', 8770, SimpleChat)
print("Starting Server ws://localhost:8770")
threading.Thread(target=server.serveforever).start()
