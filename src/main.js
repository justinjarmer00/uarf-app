const Chart = require('chart.js/auto');
const { ipcRenderer } = require('electron');
const msgpack = require('msgpack-lite'); // Ensure msgpack-lite is required

const ctx = document.getElementById('cpChart').getContext('2d');

let lastPongReceived = Date.now();
let connectionCheckTimeout;

const chartConfig = {
    type: 'scatter',
    data: {
        datasets: [{
            label: 'Top Surface',
            data: [], // This will hold the {x, y} points for the top surface
            borderColor: 'blue',
            showLine: true,
            fill: false
        }, {
            label: 'Bottom Surface',
            data: [], // This will hold the {x, y} points for the bottom surface
            borderColor: 'red',
            showLine: true,
            fill: false
        }]
    },
    options: {
        responsive: true,
        scales: {
            x: {
                beginAtZero: true
            },
            y: {
                beginAtZero: true,
                reverse: true // Invert the y-axis
            }
        }
        // ... any additional chart options you'd like to set
    }
};

// Function to parse the sensor ranges
function parseSensorRanges(input) {
    let sensors = [];
    let ranges = input.split(',').map(range => range.trim());
    for (let range of ranges) {
        let [start, end] = range.split(':').map(Number);
        if (start <= end) {
            for (let i = start; i <= end; i++) {
                sensors.push(i - 1);  // Subtracting 1 to convert to 0-based index
            }
        } else {
            for (let i = start; i >= end; i--) {
                sensors.push(i - 1);  // Subtracting 1 to convert to 0-based index
            }
        }
    }
    return sensors;
}

const cpChart = new Chart(ctx, chartConfig);

function updateConsoleDisplayWithError(message) {
    const consoleDisplay = document.getElementById('consoleDisplay');
    consoleDisplay.innerHTML += `<span style="color: red;">${message}</span>\n`;
    consoleDisplay.scrollTop = consoleDisplay.scrollHeight;  // Scroll to the bottom
}

function updateSpeedDisplay(value) {
    // Update the speed display with the given value
    document.getElementById('speedDisplay').innerText = (value/10).toFixed(1); // Assuming you want to display 2 decimal places
}

function updateAlphaDisplay(value) {
    // Update the angle of attack display with the given value
    document.getElementById('aoaDisplay').innerText = (value/10).toFixed(1); // Assuming you want to display 2 decimal places
}

function updateConsoleDisplay(message) {
    // Append the message to the console display
    const consoleElement = document.getElementById('consoleDisplay');
    consoleElement.value += message + '\n'; // Append the message and a newline
    consoleElement.scrollTop = consoleElement.scrollHeight; // Auto-scroll to the bottom
}

let calibrationData = [];

function updateCalibrationData(data) {
    calibrationData = data;
    // Any other logic you want to execute when calibration data is updated
}

function updatePressureData(pressureValues) {
    // Check calibration data and adjust pressureValues if necessary
    if (calibrationData.length === 0) {
        updateConsoleDisplayWithError("Warning: Calibration data is empty. Using raw pressure values.");
        for (let i = 0; i < pressureValues.length; i++) {
            pressureValues[i] = pressureValues[i]*10;
        }
    } else if (calibrationData.length !== pressureValues.length) {
        updateConsoleDisplayWithError("Warning: Mismatch in calibration data and pressure values length. Using raw pressure values.");
        for (let i = 0; i < pressureValues.length; i++) {
            pressureValues[i] = pressureValues[i]*10;
        }
    } else {
        for (let i = 0; i < pressureValues.length; i++) {
            pressureValues[i] = pressureValues[i]*10 - calibrationData[i];
        }
    }

    // Extract relevant pressure data based on user input
    // Parse user inputs for sensor ranges and coordinates
    let topSensors = parseSensorRanges(document.getElementById('topRangeInput').value);
    let bottomSensors = parseSensorRanges(document.getElementById('bottomRangeInput').value);
    let topCoordinates = document.getElementById('topCoordinatesInput').value.split(',').map(coord => parseFloat(coord.trim()));
    let bottomCoordinates = document.getElementById('bottomCoordinatesInput').value.split(',').map(coord => parseFloat(coord.trim()));

    let topPressureData = topSensors.map(sensor => pressureValues[sensor]);
    let bottomPressureData = bottomSensors.map(sensor => pressureValues[sensor]);

    if (topPressureData.length !== topCoordinates.length) {
        updateConsoleDisplayWithError("Error: Mismatch in top pressure data and coordinates length.");
        return;  // Exit the function early
    }

    if (bottomPressureData.length !== bottomCoordinates.length) {
        updateConsoleDisplayWithError("Error: Mismatch in bottom pressure data and coordinates length.");
        return;  // Exit the function early
    }

    // Check which radio button is selected
    const isCP = document.getElementById('cpOption').checked;

    let topData, bottomData;

    if (isCP) {
        const pitotSensor = parseInt(document.getElementById('pitotInput').value, 10);
        // Normalize the pressure values using the pitot pressure
        topData = topPressureData.map((value, index) => ({ x: topCoordinates[index], y: value / pitotSensor }));
        bottomData = bottomPressureData.map((value, index) => ({ x: bottomCoordinates[index], y: value / pitotSensor }));

        // Set y-axis range for isCP mode
        cpChart.options.scales.y.suggestedMin = -0.1;
        cpChart.options.scales.y.suggestedMax = 0.5;
    } else {
        // Create {x, y} data points for top and bottom surfaces using raw data
        topData = topSensors.map((sensor, index) => ({ x: topCoordinates[index], y: pressureValues[sensor] }));
        bottomData = bottomSensors.map((sensor, index) => ({ x: bottomCoordinates[index], y: pressureValues[sensor] }));

        // Set y-axis range for the other mode
        cpChart.options.scales.y.suggestedMin = -100;
        cpChart.options.scales.y.suggestedMax = 500;

    }

    // Update the chart's data
    cpChart.data.datasets[0].data = topData;
    cpChart.data.datasets[1].data = bottomData;

    // Refresh the chart
    cpChart.update();
}

function handlePongResponse(value) {
    if (value === 'a') {
        console.log('Received pong. Connection is alive!');

        // Update the last received time
        lastPongReceived = Date.now();

        // Clear any previous connection check timeouts
        clearTimeout(connectionCheckTimeout);

        // Restart the connection check timer
        startConnectionCheck();

        // Optionally, you can set the connection light to green here. 
        // However, the startConnectionCheck function will do that as well.
        const connectionLight = document.getElementById('connectionLight');
        connectionLight.style.backgroundColor = 'green';
    }
}

function startConnectionCheck() {
    connectionCheckTimeout = setTimeout(() => {
        if (Date.now() - lastPongReceived > 650) {
            console.log('Connection might be dead!');
            const connectionLight = document.getElementById('connectionLight');
            connectionLight.style.backgroundColor = 'red';
        } else {
            const connectionLight = document.getElementById('connectionLight');
            connectionLight.style.backgroundColor = 'green';
        }
    }, 700);  // Check every 10.5 seconds. This gives a 0.5 second buffer after the expected pong.
}

function updateGpsSpeedDisplay(value) {
    // Update the GPS speed display with the given value
    document.getElementById('gpsSpeedDisplay').innerText = value;
}

function updateGpsFixDisplay(value) {
    // Update the GPS fix display with the given value
    document.getElementById('gpsFixDisplay').innerText = value; 
}

function updateHzDisplay(value) {
    // Update the speed display with the given value
    document.getElementById('hzDisplay').innerText = value.toFixed(2); // Assuming you want to display 2 decimal places
}

const handlers = {
    p: updateSpeedDisplay,
    a: updateAlphaDisplay,
    console: updateConsoleDisplay,
    pv: updatePressureData,
    calibration: updateCalibrationData,
    q: handlePongResponse,
    gs: updateGpsSpeedDisplay,
    gf: updateGpsFixDisplay,
    h: updateHzDisplay
};

function handleParsedData(data) {
    // Use the object mapping to handle the updates
    for (const key in data) {
        if (handlers[key]) {
            handlers[key](data[key]);
        }
    }
}

let buffer = Buffer.alloc(0); // Use a Buffer instead of a string

ipcRenderer.on('serial-data', (event, data) => {
    buffer = Buffer.concat([buffer, data]);

    let delimiter;
    while ((delimiter = buffer.indexOf('|||')) !== -1) {
        // Extract the MessagePack data from the buffer, excluding the delimiter
        const packedData = buffer.subarray(0, delimiter);

        try {
            const parsedData = msgpack.decode(packedData);
            console.log(parsedData)
            handleParsedData(parsedData);
        } catch (error) {
            console.error("Failed to parse MessagePack:", error);
        }

        // Skip over the delimiter for the next part of the buffer
        buffer = buffer.subarray(delimiter + 3);
        console.log(buffer)
    }
});


document.getElementById('configButton').addEventListener('click', () => {
    ipcRenderer.send('toggle-config-window');
});

document.getElementById('replayButton').addEventListener('click', () => {
    ipcRenderer.send('toggle-replay-window');
});

// Event listener for the "Make Directory" button
document.getElementById('makeDirectory').addEventListener('click', () => {
    const dirName = document.getElementById('dirNameInput').value;
    const command = `mkdir ${dirName}\n`;
    ipcRenderer.send('send-serial-message', command);
});

// Event listener for the "Select Directory" button
document.getElementById('selectDirectory').addEventListener('click', () => {
    const dirName = document.getElementById('selectDirInput').value;
    const command = dirName ? `select_dir ${dirName}\n` : 'select_dir\n';
    ipcRenderer.send('send-serial-message', command);
});

// Event listener for the "Calibrate" button
document.getElementById('calibrate').addEventListener('click', () => {
    const numSamples = document.getElementById('numSamplesInput').value;
    const command = numSamples ? `calibrate ${numSamples}\n` : 'calibrate\n';
    ipcRenderer.send('send-serial-message', command);
});

// Event listener for the "Run Flight Test" button
document.getElementById('runFlightTest').addEventListener('click', () => {
    const sampleRate = document.getElementById('sampleRateHz').value;
    const command = sampleRate ? `run_flight_test ${sampleRate}\n` : 'run_flight_test\n';
    ipcRenderer.send('send-serial-message', command);
});

// Event listener for the "Start Collection" button
document.getElementById('startCollection').addEventListener('click', () => {
    const command = 'start\n';
    ipcRenderer.send('send-serial-message', command);
});

// Event listener for the "End Collection" button
document.getElementById('endCollection').addEventListener('click', () => {
    const command = 'end\n';
    ipcRenderer.send('send-serial-message', command);
});

// Event listener for the "Quit Flight Test" button
document.getElementById('quitFlightTest').addEventListener('click', () => {
    const command = 'quit\n';
    ipcRenderer.send('send-serial-message', command);
});

// Event listener for the "Send Message" button (for the serial input)
document.getElementById('sendMessage').addEventListener('click', () => {
    const message = document.getElementById('serialInput').value;
    ipcRenderer.send('send-serial-message', message + '\n'); // Assuming newline is needed at the end
});

// Start sending ping messages
const pingInterval = setInterval(() => {
    const command = 'ping\n';
    ipcRenderer.send('send-serial-message', command);
}, 500);  // Sending ping every .5 seconds

startConnectionCheck();