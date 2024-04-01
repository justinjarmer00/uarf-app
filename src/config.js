const selectedBaudRate = parseInt(document.getElementById('baudRate').value, 10);

let isConnected = false;

document.getElementById('refreshButton').addEventListener('click', () => {
    loadSerialPorts(); // Reload the serial port list
    // You can also refresh other configuration data here if necessary
});

async function loadSerialPorts() {
    const ports = await window.ipc.invoke('get-serial-ports');
    const dropdown = document.getElementById('serialPortsDropdown');
    dropdown.innerHTML = ports.map(port => `<option value="${port}">${port}</option>`).join('');
}

document.getElementById('connectButton').addEventListener('click', () => {
    const selectedPort = document.getElementById('serialPortsDropdown').value;
    const selectedBaudRate = parseInt(document.getElementById('baudRate').value, 10);

    if (isConnected) {
        // Disconnect logic
        window.ipc.send('disconnect-from-port');
    } else {
        //connect logic
        window.ipc.send('connect-to-port', {
            port: selectedPort, 
            baudRate: selectedBaudRate
        });
    }
});

window.ipc.on('connection-status', (status) => {
    const connectButton = document.getElementById('connectButton');
    const statusLight = document.getElementById('statusLight');
    const statusText = document.getElementById('statusText');

    if (status === 'connected') {
        isConnected = true;
        statusLight.style.backgroundColor = 'green';
        statusText.textContent = 'Connected';
        connectButton.textContent = 'Disconnect';
    } else if (status === 'error') {
        isConnected = false;
        statusLight.style.backgroundColor = 'red';
        statusText.textContent = 'Error';
        connectButton.textContent = 'Connect';
    } else if (status === 'disconnected'){
        isConnected = false;
        statusLight.style.backgroundColor = 'red';
        statusText.textContent = 'Disconnected';
        connectButton.textContent = 'Connect';
    }
});

window.ipc.on('initialize-config', (data) => {
    console.log('here', data)
    const { isConnected, selectedPort, selectedBaudRate } = data;
    
    // Update connection status
    const connectButton = document.getElementById('connectButton');
    const statusLight = document.getElementById('statusLight');
    const statusText = document.getElementById('statusText');
    if (isConnected) {
        connectButton.textContent = 'Disconnect';
        statusLight.style.backgroundColor = 'green';
        statusText.textContent = 'Connected';
    } else {
        connectButton.textContent = 'Connect';
        statusLight.style.backgroundColor = 'red';
        statusText.textContent = 'Disconnected';
    }

    // Set selected port and baud rate
    if (selectedPort) {
        const portDropdown = document.getElementById('serialPortsDropdown');
        portDropdown.value = selectedPort;
    }
    if (selectedBaudRate) {
        const baudRateDropdown = document.getElementById('baudRate');
        baudRateDropdown.value = selectedBaudRate;
    }
});

window.ipc.on('rate-update', (rates) => {
    console.log(rates)
    //console.log(event)
    document.getElementById('sentDisplay').innerText = rates.sentRate.toFixed(0);
    document.getElementById('receiveDisplay').innerText = rates.receivedRate.toFixed(0);
});


// Load serial ports when the window is loaded
window.onload = loadSerialPorts;