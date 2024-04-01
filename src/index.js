process.traceDeprecation = true;

const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const msgpack = require('msgpack-lite');

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('profile.db', (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Database connected!');
  }
});

db.run(`CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT
)`, (err) => {
    if (err) {
        console.error('Error creating config table', err.message);
    } else {
        console.log('Config table created or already exists');
    }
});

db.run(`CREATE TABLE IF NOT EXISTS datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    json TEXT
)`, (err) => {
    if (err) {
        console.error('Error creating datasets table', err.message);
    } else {
        console.log('Datasets table created or already exists');
    }
});

db.run(`CREATE TABLE IF NOT EXISTS customDisplays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    displayKey TEXT,
    displayType TEXT
)`);


function saveConfig(key, value) {
    db.run(`REPLACE INTO config (key, value) VALUES (?, ?)`, [key, value], (err) => {
        if (err) {
            console.error('Error saving config', err.message);
        } else {
            console.log(`Config saved: ${key} = ${value}`);
        }
    });
}

function saveDataSet(dataset) {
    const dataString = JSON.stringify(dataset);
    const name = dataset.name;

    db.run(`INSERT INTO datasets (name, json) VALUES (?, ?)`, [name, dataString], (err) => {
        if (err) {
            console.error('Error saving dataset', err.message);
        } else {
            console.log('DataSet saved successfully');
        }
    });
}

function loadDataSetPlaceholders() {
    db.all(`SELECT id, name FROM datasets`, [], (err, rows) => {
        if (err) {
            console.error('Error loading dataset placeholders', err.message);
        } else {
            dataSets = rows.map(row => ({ id: row.id, name: row.name }));
            console.log('DataSet placeholders loaded:', dataSets);
            // Update the renderer process, if necessary
            if (mainWindow) {
                mainWindow.webContents.send('update-dataset-placeholders', dataSets);
            }
            if (fileSelectWindow) {
                fileSelectWindow.webContents.send('initialize-dataSets', dataSets);
            }
            if (replayWindow) {
                replayWindow.webContents.send('update-datasets', dataSets);
            }
        }
    });
}

let mainWindow;
let configWindow;
let testingWindow;
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

    db.get(`SELECT value FROM config WHERE key = ?`, ['baudRate'], (err, row) => {
        if (err) {
            console.error('Error loading config', err.message);
        } else if (row) {
            configState.selectedBaudRate = row.value;
            console.log(`Loaded config: baudRate = ${configState.selectedBaudRate}`);
        }
    });

    // Load dataset placeholders
    loadDataSetPlaceholders();    

    mainWindow.on('close', function() {
        app.quit();
    });
});

//dataset requests
async function loadFullDataSet(datasetId) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT json FROM datasets WHERE id = ?`, [datasetId], (err, row) => {
            if (err) {
                console.error('Error loading dataset:', err);
                reject(err);
            } else if (row) {
                const dataset = JSON.parse(row.json);
                console.log('sent dataset')
                //console.log(dataset)
                resolve(dataset);
            } else {
                console.log('sent null dataset')
                resolve(null);
            }
        });
    });
}

async function updateDataSet(pair) {
    return new Promise((resolve, reject) => {
        const dataString = JSON.stringify(pair.dataset);
        console.log('dataset updated', pair.dataset.name)
        db.run(`UPDATE datasets SET name = ?, json = ? WHERE id = ?`, [pair.dataset.name, dataString, pair.id], (err) => {
            if (err) {
                console.error('Error updating dataset:', err);
                reject(err);
            } else {
                console.log('Update successful for', pair.dataset.name, pair.id);
                // Load dataset placeholders after the update is successful
                loadDataSetPlaceholders();
                resolve();
            }
        });
    });
}

async function addNewDataSet(newDataset) {
    return new Promise((resolve, reject) => {
        console.log('new data set added', newDataset.name)
        const dataString = JSON.stringify(newDataset);
        db.run(`INSERT INTO datasets (name, json) VALUES (?, ?)`, [newDataset.name, dataString], (err) => {
            if (err) {
                console.error('Error adding new dataset:', err);
                reject(err);
            } else {
                resolve();
            }
            // Load dataset placeholders
            loadDataSetPlaceholders();
        });
    });
}

async function deleteDataSet(datasetId) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM datasets WHERE id = ?`, [datasetId], (err) => {
            if (err) {
                console.error('Error deleting dataset:', err);
                reject(err);
            } else {
                resolve();
            }
            // Load dataset placeholders
            loadDataSetPlaceholders();
        });
    });
}

function sendCustomDisplay(win) {
    db.all(`SELECT * FROM customDisplays`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching custom display configurations:', err);
            return;
        }
        console.log('Sending custom display configurations:', rows); // Check the data
        win.webContents.send('custom-display-configurations', rows);
    });
}


ipcMain.on('request-dataset', async (event, datasetId) => {
    console.log(datasetId)
    const dataset = await loadFullDataSet(datasetId);
    event.reply('dataset-response', dataset);
});

ipcMain.on('update-dataset', async (event, pair) => {
    console.log('Received dataset with ID:', pair.dataset.name);
    await updateDataSet(pair);
});

ipcMain.on('add-dataset', async (event, newDataset) => {
    await addNewDataSet(newDataset);
});

ipcMain.on('delete-dataset', async (event, datasetId) => {
    await deleteDataSet(datasetId);
});

ipcMain.on('update-custom-display', (event, { quadrantId, displayKey, displayType }) => {
    db.run(`
        INSERT INTO customDisplays (id, displayKey, displayType) 
        VALUES (?, ?, ?) 
        ON CONFLICT(id) DO UPDATE SET 
        displayKey = excluded.displayKey, 
        displayType = excluded.displayType`,
        [quadrantId, displayKey, displayType], function(err) {
            if (err) {
                console.error('Error updating custom display:', err);
                return;
            }
            if (this.changes === 0) {
                console.log(`No changes made to the custom display for quadrant ${quadrantId}`);
            } else {
                console.log(`Custom display updated for quadrant ${quadrantId}`);
            }
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

ipcMain.on('toggle-testing-window', () => {
    if (testingWindow) {
        testingWindow.close();
        testingWindow = null;
    } else {
        testingWindow = new BrowserWindow({
            width: 800,
            height: 800,
            webPreferences: {
                /// preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        testingWindow.loadFile('src/testing.html');
        //configWindow.webContents.openDevTools();
  
        testingWindow.on('ready-to-show', () => {
          sendCustomDisplay(testingWindow);
        });
  
        // Set the configWindow variable to null when the window is closed
        testingWindow.on('closed', () => {
            testingWindow = null;
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

    async function sendFull(index) {
        let dataset = await loadFullDataSet(dataSets[index].id)
        analysisWindow.webContents.send('dataset', dataset);
    };

    analysisWindow.on('ready-to-show', () => {
        sendFull(index)
        // let dataset = await loadFullDataSet(dataSets[index].id)
        // //console.log("Sending dataset:", dataset);
        // analysisWindow.webContents.send('dataset', dataset);
    });
});

ipcMain.on('connect-to-port', (event, data) => {
    const { port: selectedPort, baudRate: selectedBaudRate } = data;
    saveConfig('baudRate', selectedBaudRate);
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
        if (testingWindow) {
            testingWindow.webContents.send('serial-data', data);
        }
        
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
    saveDataSet(dataSets[0])
    replayWindow.webContents.send('update-datasets', dataSets);
});