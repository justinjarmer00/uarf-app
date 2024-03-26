process.traceDeprecation = true;

const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const msgpack = require('msgpack-lite');

let mainWindow;
let configWindow;
let replayWindow;
let fileSelectWindow;
// let interval;
let port;
let dataSets = [];

let bytesSentSinceLastInterval = 0;
let bytesReceivedSinceLastInterval = 0;
const intervalDuration = 1000; // 1 second, adjust as needed

setInterval(() => {
    const sentRate = bytesSentSinceLastInterval / intervalDuration * 1000; // Bytes per second
    const receivedRate = bytesReceivedSinceLastInterval / intervalDuration * 1000; // Bytes per second

    // Update the UI with sentRate and receivedRate
    // For example, you might send these rates to your renderer process
    if (configWindow) {
        configWindow.webContents.send('rate-update', { sentRate, receivedRate });
    }
    

    // Reset the counters
    bytesSentSinceLastInterval = 0;
    bytesReceivedSinceLastInterval = 0;
}, intervalDuration);

ipcMain.handle('get-sources', async (event) => {
    const inputSources = await desktopCapturer.getSources({
        types: ['window', 'screen']
    });
    return inputSources;
});

let configState = {
    isConnected: false,
    selectedPort: null,
    selectedBaudRate: null
};

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            //preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('src/main.html');
    //mainWindow.webContents.openDevTools();
    mainWindow.on('close', function() {
        app.quit();
    });
});

ipcMain.handle('get-serial-ports', async () => {
  try {
      const ports = await SerialPort.list();
      return ports.map(port => port.path);
  } catch (error) {
      console.error('Failed to list serial ports:', error);
      return [];
  }
});

ipcMain.on('toggle-config-window', () => {
  if (configWindow) {
      configWindow.close();
      configWindow = null;
  } else {
      configWindow = new BrowserWindow({
          width: 600,
          height: 600,
          webPreferences: {
              preload: path.join(__dirname, 'preload.js'),
              contextIsolation: true
          }
      });
      configWindow.loadFile('src/config.html');
      //configWindow.webContents.openDevTools();

      configWindow.on('ready-to-show', () => {
        console.log("Sending configState:", configState);
        //let option = 15;
        configWindow.webContents.send('initialize-config', configState);
      });

      // Set the configWindow variable to null when the window is closed
      configWindow.on('closed', () => {
          configWindow = null;
      });
  }
});

ipcMain.on('toggle-replay-window', () => {
    if (replayWindow) {
        replayWindow.close();
        replayWindow = null;
    } else {
        replayWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        replayWindow.loadFile('src/replay.html');
        //configWindow.webContents.openDevTools();

        replayWindow.on('ready-to-show', () => {
            replayWindow.webContents.send('update-datasets', dataSets);
        });
        
        replayWindow.on('close', () => {
            replayWindow.webContents.send('clear-timers')
        })

        // Set the configWindow variable to null when the window is closed
        replayWindow.on('closed', () => {
            replayWindow = null;
        });
    }
});

ipcMain.on('toggle-fileSelect-window', () => {
    if (fileSelectWindow) {
        fileSelectWindow.close();
        fileSelectWindow = null;
    } else {
        fileSelectWindow = new BrowserWindow({
            width: 800,
            height: 625,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true
            }
        });
        fileSelectWindow.loadFile('src/fileSelect.html');
        //fileSelectWindow.webContents.openDevTools();
        fileSelectWindow.on('ready-to-show', () => {
            //console.log("Sending dataSets (from index):", dataSets);
            fileSelectWindow.webContents.send('initialize-dataSets', dataSets);
        });
        
        // Set the configWindow variable to null when the window is closed
        fileSelectWindow.on('closed', () => {
            fileSelectWindow = null;
        });
    }
});

//ipcRenderer.send('toggle-dataset-analysis-window', index);
ipcMain.on('toggle-dataset-analysis-window', (event, data) => {
    index = data;
    //console.log(index)
    analysisWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    });
    analysisWindow.loadFile('src/analysis.html');
    //fileSelectWindow.webContents.openDevTools();
    analysisWindow.on('ready-to-show', () => {
        let dataset = dataSets[index]
        //console.log("Sending dataset:", dataset);
        analysisWindow.webContents.send('dataset', dataset);
    });
});

ipcMain.on('connect-to-port', (event, data) => {
    const { port: selectedPort, baudRate: selectedBaudRate } = data;

    console.log(selectedPort);
    console.log(selectedBaudRate);

    if (port && port.isOpen) {
        port.close();
        port = null;
    }

    const portOptions = {
        path: selectedPort,  // e.g., 'COM3' on Windows or '/dev/tty-usbserial1' on macOS/Linux
        baudRate: selectedBaudRate  // e.g., 9600
    };
    
    port = new SerialPort(portOptions);
    
    //const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    //parser.on('data', (line) => {
        //console.log('Received:', line);
    //});

    port.on('data', (data) => {
        bytesReceivedSinceLastInterval += data.length;
        //console.log(data)
        // Convert the Buffer data to a string (assuming UTF-8 encoding) // or leave it :)
        // const receivedData = data.toString('utf8');
        
        // Log the received data
        //console.log(receivedData);

        // Send the received data to the renderer process
        mainWindow.webContents.send('serial-data', data);//receivedData);
    })

    port.on('open', () => {
        console.log('Port opened successfully');
        if (configWindow) {
            configWindow.webContents.send('connection-status', 'connected');
        }
    });
    
    port.on('error', (err) => {
        console.error('Error:', err.message);
        if (configWindow) {
            configWindow.webContents.send('connection-status', 'error');
        }
    });

    port.on('close', () => {
        console.log('Port closed');
        if (configWindow) {
            configWindow.webContents.send('connection-status', 'disconnected');
        }

        // Update the configState
        configState.isConnected = false;
    });

    // Update the configState
    configState.isConnected = true;
    configState.selectedPort = selectedPort;
    configState.selectedBaudRate = selectedBaudRate;
});

ipcMain.on('disconnect-from-port', (event) => {
    if (port && port.isOpen) {
        port.close((err) => {
            if (err) {
                console.error('Failed to close port:', err.message);
                configWindow.webContents.send('connection-status', 'error');
            } else {
                console.log('Port closed successfully');
                configWindow.webContents.send('connection-status', 'disconnected');
            }
        });

        // Update the configState
        configState.isConnected = false;
    }
});

ipcMain.on('send-serial-message', (event, message) => {
    if (port && port.isOpen) {
        bytesSentSinceLastInterval += message.length;
        port.write(message, (err) => {
            if (err) {
                console.error('Failed to send message:', err.message);
            } else {
                console.log('Message sent:', message);
            }
        });
    }
});

ipcMain.on('update-datasets', (event, data) => {
    dataSets = data
    replayWindow.webContents.send('update-datasets', dataSets);
});