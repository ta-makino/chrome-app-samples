var onload = function() {
  var tcpServer = chrome.sockets.tcpServer;
  var tcpSocket = chrome.sockets.tcp;

  var serverSocketId = null;

  var stringToUint8Array = function(string) {
    var buffer = new ArrayBuffer(string.length);
    var view = new Uint8Array(buffer);
    for (var i = 0; i < string.length; i++) {
      view[i] = string.charCodeAt(i);
    }
    return view;
  };

  var arrayBufferToString = function(buffer) {
    var str = '';
    var uArrayVal = new Uint8Array(buffer);
    for (var s = 0; s < uArrayVal.length; s++) {
      str += String.fromCharCode(uArrayVal[s]);
    }
    return str;
  };

  var destroySocketById = function(socketId) {
    tcpSocket.disconnect(socketId, function() {
      tcpSocket.close(socketId);
    });
  };

  var closeServerSocket = function() {
    if (serverSocketId) {
      tcpServer.close(serverSocketId, function() {
        if (chrome.runtime.lastError) {
          console.warn("chrome.sockets.tcpServer.close:", chrome.runtime.lastError);
        }
      });
    }

    tcpServer.onAccept.removeListener(onAccept);
    tcpSocket.onReceive.removeListener(onReceive);
  };

  var sendReplyToSocket = function(socketId, buffer) {
    console.log(arrayBufferToString(buffer));
    // verify that socket is still connected before trying to send data
    tcpSocket.getInfo(socketId, function(socketInfo) {
      if (!socketInfo.connected) {
        destroySocketById(socketId);
        return;
      }
      tcpSocket.send(socketId, buffer, function(writeInfo) {
        console.log("WRITE", writeInfo);
        destroySocketById(socketId);
      });
    });
  };

  var getSuccessHeader = function() {
    var httpStatus = "HTTP/1.0 200 OK";
    var lines = [
      httpStatus,
      "Content-length: 8",
      "Content-type: text/plain"
    ];
    console.log(httpStatus);

    return stringToUint8Array(lines.join("\n") + "\n\n");
  };

  var write200Response = function(socketId) {
    var header = getSuccessHeader();
    var outputBuffer = new ArrayBuffer(header.byteLength + 8);
    var view = new Uint8Array(outputBuffer);
    view.set(header, 0);
    view.set(stringToUint8Array('Success!'), header.byteLength);
    sendReplyToSocket(socketId, outputBuffer);
  };

  var onAccept = function(acceptInfo) {
    tcpSocket.setPaused(acceptInfo.clientSocketId, false);

    if (acceptInfo.socketId != serverSocketId)
      return;

    console.log("ACCEPT", acceptInfo);
  };

  var onReceive = function(receiveInfo) {
    console.log("READ", receiveInfo);
    var socketId = receiveInfo.socketId;

    // Parse the request.
    var data = arrayBufferToString(receiveInfo.data);
    // we can only deal with GET requests
    if (data.indexOf("GET ") !== 0) {
      // close socket and exit handler
      destroySocketById(socketId);
      return;
    }

    var uriEnd = data.indexOf(" ", 4);
    if (uriEnd < 0) { /* throw a wobbler */ return; }
    var uri = data.substring(4, uriEnd);
    
    chrome.browser.openTab({url: uri}, function(){
       console.log("GET 200 " + uri);
       write200Response(socketId);
    });
  };

    tcpServer.create({}, function(socketInfo) {
      serverSocketId = socketInfo.socketId;

      tcpServer.listen(serverSocketId, "127.0.0.1", 28283, 50, function(result) {
        console.log("LISTENING:", result);

        tcpServer.onAccept.addListener(onAccept);
        tcpSocket.onReceive.addListener(onReceive);
      });
    });
};

chrome.app.runtime.onLaunched.addListener(function(intentData) {
  onload();
});


