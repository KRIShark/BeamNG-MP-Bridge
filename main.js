// Logging
var moment = require('moment');
const path = require('path')
const os = require('os');
var fs = require('fs');
const util = require("util");
const stripAnsi = require('strip-ansi');
var argv = require('minimist')(process.argv.slice(2));
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
var pjson = require('./package.json');
console.log(pjson.version);

if (!fs.existsSync('./logs')){
  fs.mkdirSync('./logs');
}
var serverStartTime = moment().format("YYYY_MM_DD_HH_mm");
var log_file = fs.createWriteStream("./logs/BeamNG-MP_"+serverStartTime+".log", { flags: 'a' });
var log_stdout = process.stdout;
console.log = function(d){
  log_file  .write("["+moment().format("YYYY-MM-DD - HH:mm:ssZ")+"]"+util.format(stripAnsi(d))+"\r\n");
  log_stdout.write("["+moment().format("YYYY-MM-DD - HH:mm:ssZ")+"]"+util.format(d)+"\r\n");
}

/*process
.on('unhandledRejection', (reason, p) => {
  console.error(reason, 'Unhandled Rejection at Promise', p);
  console.log(err);
  const messageBoxOptions = {
    type: "error",
    title: "Error in Main process (unhandledRejection)",
    message: "Oh Snap... Something has gone wrong somewhere. Please send your log file to the develpers by typing '-new I have a crash report/log' in the support channel in our discord server. Thank you and sorry again."
  };
  dialog.showMessageBox(messageBoxOptions);
  //throw err;
})
.on('uncaughtException', err => {
  console.error(err, 'Uncaught Exception thrown');
  console.log(err);
  const messageBoxOptions = {
    type: "error",
    title: "Error in Main process (uncaughtException)",
    message: "Oh Snap... Something has gone wrong somewhere. Please send your log file to the develpers by typing '-new I have a crash report/log' in the support channel in our discord server. Thank you and sorry again."
  };
  dialog.showMessageBox(messageBoxOptions);
  //throw err;
  //process.exit(1);
});*/

function DisplayError(type, title, message) {
  const messageBoxOptions = {
    type: type,
    title: title,
    message: message
  };
  dialog.showMessageBox(messageBoxOptions);
}

var Name = "Bridge"
var filename = "config.json"
var cfgLoaded = false
var uiLoaded = false
var cfg = {
  ["darkmode"]: true,
  ["use_rudp"]: true,
  ["settings"]: {
    ["local"]: {
      ["tcp"]: 4444,
      ["udp"]: 4445,
      ["ws"]: 4446,
    },
    ["remote"]: {
      ["ip"]: "127.0.0.1",
      ["tcp"]: 30813,
      ["udp"]: 30814,
      ["ws"]: 30815,
    },
  }
}

fs.open(filename,'r',function(err, fd){
  if (err) {
    fs.writeFile(filename, JSON.stringify(cfg, null, 4), function(err) {
      if(err) {
        console.log(err);
      }
      console.log("Config file created.");
    });
  } else {
    cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    if (uiLoaded) {
      win.webContents.send('settings', cfg);
    } else {
      cfgLoaded = true
    }
  }
});

function SaveConfig(cfg) {
  fs.writeFile('config.json', JSON.stringify(cfg, null, 4), function (err) {
    if (err) {
      DisplayError(err)
      console.log(err);
      throw err;
    }
    console.log('Config Saved!');
  });
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({
    frame: false,
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true
    }
  })

  // and load the index.html of the app.
  win.loadFile('index.html')

  // Open the DevTools.
  if (argv.dev) {
    win.webContents.openDevTools()
  }

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
  if (cfgLoaded) {
    win.webContents.send('settings', cfg);
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Settings
///////////////////////////////////////////////
var checkboxes = {
  ["TCPIN"]: false,
  ["TCPOUT"]: false,
  ["UDPIN"]: false,
  ["UDPOUT"]: false,
  ["WSIN"]: false,
  ["WSOUT"]: false,
}

// IPC Handler
///////////////////////////////////////////////
ipcMain.on('hello', (event, args) => {
  console.log("Hello Event: "+args)
  uiLoaded = true
  event.sender.send('fromMain','Hi, asyn reply');
  event.sender.send('settings', cfg);
  event.sender.send('version', pjson.version);
  win.webContents.send('console', `[${Name}] Config Loaded.`);
});

ipcMain.on('checkboxes', (event, args) => {
  checkboxes = args;
});

ipcMain.on('log', (event, args) => {
  console.log(args);
});

ipcMain.on('control', (event, args) => {
  //console.log(args)
  if (args.option == "START") {
    Start(args);
    cfg.settings.local = args.local
    cfg.settings.remote = args.remote
    SaveConfig(cfg)
    win.webContents.send('console', `[${Name}] Config Updated.`);
  } else if (args.option == "RESET") {
    Reset(args)
  }
});

const net = require('net');
//var rudp = require('rudp');
var dgram = require('dgram');

var TCPserver = net.createServer();
var TCPclient = new net.Socket();

var UDPserver = dgram.createSocket('udp4');
var UDPclient = dgram.createSocket('udp4');
//var socket    = dgram.createSocket('udp4');

function Start(config) {
  // TCP Server
  ///////////////////////////////////////////////
  TCPserver.listen(Number(config.local.tcp), () => {
    win.webContents.send('console', `[TCP][${Name}] TCP Ready & Listening on port: ${config.local.tcp}`);
  });

  TCPserver.on('connection', function(sock) {
    // Show user that game connected
    win.webContents.send('console', `[TCP][Game -> ${Name}] Game Connected`);
    if (!config.use_rudp) {
      // TCP Client
      ///////////////////////////////////////////////
      TCPclient.connect(Number(config.remote.tcp), config.remote.ip, function() {
        win.webContents.send('console', `[TCP][${Name} --> Server] TCP Connected`);
      });

      TCPclient.on('data', function(cdata) {
        if (checkboxes.TCPIN) {
          win.webContents.send('console', `[TCP][Server --> Client] ${cdata}`);
        }
        sock.write(cdata);
      });

      TCPclient.on('close', function() {
        //console.log('Connection closed');
      });
    } else if (config.use_rudp) {
      /*var client = new rudp.Client(socket, config.remote.udp, config.remote.ip);
      win.webContents.send('console', `[RUDP][${Name} --> Server] RUDP Connected`);

      client.on('data', function (data) {
        if (checkboxes.TCPIN) {
          win.webContents.send('console', `[RUDP][Server --> Client] ${cdata}`);
        }
        sock.write(cdata);
      });*/
    }


    sock.on('data', function(data) {
      if (!config.use_rudp) {
        if (checkboxes.TCPOUT) {
          win.webContents.send('console', `[TCP][Client --> Server] ${data}`);
        }
        TCPclient.write(data);
      } else if (config.use_rudp) {
        /*if (checkboxes.UDPOUT) {
          win.webContents.send('console', `[RUDP][Client --> Server] ${data}`);
        }
        client.send(data);*/
      }
    });

    sock.on('close', function(data) {
      win.webContents.send('console', `[TCP][Game -> ${Name}] Game Disconnected`);
    });

    sock.on('error', (err) => {
      if (config.use_rudp) {
        win.webContents.send('console', `[RUDP][${Name}] RUDP Error Seek Developer Help!`);
        DisplayError('error', "RUDP Socket Error", 'Sorry there has been an issue with the RUDP Socket needed to play multiplayer. Please send your most recent log file to the developers of the mod. Then restart this bridge and try again.')
      } else {
        win.webContents.send('console', `[TCP][${Name}] TCP Error Seek Developer Help!`);
        DisplayError('error', "TCP Socket Error", 'Sorry there has been an issue with the TCP Socket needed to play multiplayer. Please send your most recent log file to the developers of the mod. Then restart this bridge and try again.')
      }
      //win.webContents.send('err', err);
      console.log(err);
    });

    function ResetTCP() {
      TCPclient.destroy();
      TCPserver.close(function () {
        TCPserver.unref();
        win.webContents.send('console', `[TCP] Server Connection Closed.`);
      });
    }
  });



  // UDP Server
  ///////////////////////////////////////////////
  var Rinfo = {}
  UDPserver.on('listening', function() {
    win.webContents.send('console', `[UDP][${Name}] UDP Ready & Listening on port: ${config.local.udp}`);
  });
  // UDP Client
  ///////////////////////////////////////////////
  UDPclient.on('message',function(msg,info){
    if (checkboxes.UDPIN) {
      win.webContents.send('console', `[UDP][Server --> Client] ${msg.toString()}`);
    }
    UDPserver.send(msg,Rinfo.port,Rinfo.address,function(err){
      if(err){
        win.webContents.send('console', `[TCP][${Name}] UDP(server) Error Seek Developer Help!`);
        //win.webContents.send('err', err);
        DisplayError('error', "UDP Socket Error", 'Sorry there has been an issue with the UDP Socket needed to play multiplayer. Please send your most recent log file to the developers of the mod. Then restart this bridge and try again.')
        console.log(err);
      }else{
        //console.log('Data sent !!!');
      }
    });
  });
  UDPserver.on('message',function(msg,rinfo){
    Rinfo = rinfo;
    UDPclient.send(msg,config.remote.udp,config.remote.ip,function(err){
      if(err){
        win.webContents.send('console', `[TCP][${Name}] UDP (client) Error Seek Developer Help!`);
        //win.webContents.send('err', err);
        DisplayError('error', "UDP Socket Error", 'Sorry there has been an issue with the UDP Socket needed to play multiplayer. Please send your most recent log file to the developers of the mod. Then restart this bridge and try again.')
        console.log(err);
      }else{
        if (checkboxes.UDPOUT) {
          win.webContents.send('console', `[UDP][Client --> Server] ${msg.toString()}`);
        }
      }
    });
  });
  UDPserver.bind(Number(config.local.udp));
  function ResetUDP() {
    UDPclient.close();
    win.webContents.send('console', `[UDP] Client Connection Closed.`);
    UDPserver.close();
    win.webContents.send('console', `[UDP] Server Connection Closed.`);
  }

  // WS Client
  ///////////////////////////////////////////////

  // WS Server
  ///////////////////////////////////////////////
  /*const WebSocket = require('ws');

  const wss = new WebSocket.Server({ port: wsport });

  wss.on('connection', function connection(ws) {
  ws.on('message', function incoming(message) {
  console.log('[WS] received: %s', message);
  wss.clients.forEach(function each(client) {
  if (client.readyState === WebSocket.OPEN) {
  client.send(message);
}
});
});

ws.send('Welcome!');
});*/
}

function Reset(config) {
  console.log("Reset Called");
  ResetUDP();
  ResetTCP();
  Start(config)
}
