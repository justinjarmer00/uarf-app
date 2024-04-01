const Chart = require('chart.js/auto');
const { ipcRenderer } = require('electron');
const msgpack = require('msgpack-lite');

let charts = [null,null,null,null]

// Data buffers for each quadrant
let dataBuffers = {
    1: [],
    2: [],
    3: [],
    4: []
};

const MAX_DURATION = 15000; // 15 seconds

// Function to update data for a quadrant
function updateData(quadrantId, newValue) {
    const now = Date.now();
    let buffer = dataBuffers[quadrantId];

    // Add new value
    buffer.push({ time: now, value: newValue });

    // Remove old values (older than 5 seconds)
    buffer = buffer.filter(point => now - point.time <= MAX_DURATION);

    // Update the buffer
    dataBuffers[quadrantId] = buffer;

    // Update display
    updateDisplay(quadrantId);
}

// Function to update the display of a quadrant
function updateDisplay(quadrantId) {
    const quadrant = document.querySelector(`.quadrant[data-quadrant-id="${quadrantId}"]`);
    const displayType = quadrant.querySelector('.display-type').value;
    const contentDiv = quadrant.querySelector('.content');
    const buffer = dataBuffers[quadrantId];

    if (displayType === 'text') {
        // Show the latest value for text/numeric displays
        contentDiv.textContent = buffer[buffer.length - 1]?.value;
    } else if (displayType === 'graph') {
        // Plot the graph for the last 5 seconds
        const canvas = quadrant.querySelector('canvas');
        if (!canvas) return; // No canvas to draw on

        const ctx = canvas.getContext('2d');
        // Assuming `myChart` is already initialized and is a Chart.js instance
        const chart = charts[quadrantId - 1]; // Assuming this is the correct way to reference the chart
        if (chart) {
            chart.data.labels = buffer.map(point => new Date(point.time).toLocaleTimeString());
            chart.data.datasets[0].data = buffer.map(point => point.value);
            chart.update();
        }
    }
}

function handleParsedData(parsedData) {
    // Iterate over each data key in the parsed data
    for (const key in parsedData) {
        // Find the quadrant that is listening for this key
        document.querySelectorAll('.quadrant').forEach(quadrant => {
            const displayKey = quadrant.querySelector('.key-input').value;
            if (key === displayKey) {
                const quadrantId = quadrant.getAttribute('data-quadrant-id');
                updateData(quadrantId, parsedData[key]);
            }
        });
    }
}


// IPC event listener for incoming data
ipcRenderer.on('data-update', (event, { quadrantId, value }) => {
    updateData(quadrantId, value);
});


document.querySelectorAll('.update-button').forEach(button => {
    button.addEventListener('click', function() {
        const quadrant = this.closest('.quadrant');
        //const contentDiv = quadrant.querySelector('.content');
        const displayType = quadrant.querySelector('.display-type').value;
        const displayKey = quadrant.querySelector('.key-input').value;
        const quadrantId = quadrant.getAttribute('data-quadrant-id');
        createDisplayContent(quadrant, displayType, displayKey)
        // Send the updated configuration to the main process
        ipcRenderer.send('update-custom-display', { quadrantId, displayKey, displayType });
    });
});


// Function to create display content based on type and key
function createDisplayContent(quadrant, displayType, displayKey) {
    const contentDiv = quadrant.querySelector('.content');
    const quadrantId = parseInt(quadrant.getAttribute('data-quadrant-id'), 10) - 1; // Assuming quadrant IDs start from 1
    contentDiv.innerHTML = ''; // Clear existing content

    // Remove any existing chart in this quadrant
    if (charts[quadrantId]) {
        charts[quadrantId].destroy();
        charts[quadrantId] = null;
    }

    if (displayType === 'text') {
        const textDisplay = document.createElement('div');
        textDisplay.classList.add('text-display');
        textDisplay.textContent = displayKey; // Use displayKey or fetch associated data
        contentDiv.appendChild(textDisplay);
    } else if (displayType === 'graph') {
        const canvas = document.createElement('canvas');
        canvas.classList.add('chart-container');
        contentDiv.appendChild(canvas);

        const ctx = canvas.getContext('2d');
        charts[quadrantId] = new Chart(ctx, {
            type: 'line', // Example chart type
            data: {
                labels: ['Label 1', 'Label 2', 'Label 3'], // Example labels
                datasets: [{ 
                    label: displayKey, 
                    data: [10, 20, 30] // Placeholder data
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
            }
        });
    }
}


// Function to handle incoming configuration data
ipcRenderer.on('custom-display-configurations', (event, configurations) => {
    configurations.forEach((config) => {
        const quadrant = document.querySelector(`.quadrant[data-quadrant-id="${config.id}"]`);
        if (quadrant) {
            quadrant.querySelector('.key-input').value = config.displayKey;
            quadrant.querySelector('.display-type').value = config.displayType;
            createDisplayContent(quadrant, config.displayType, config.displayKey);
        }
    });
});

window.addEventListener('resize', () => {
    document.querySelectorAll('.quadrant').forEach(quadrant => {
        
        const displayType = quadrant.querySelector('.display-type').value;
        const displayKey = quadrant.querySelector('.key-input').value;
        console.log(displayKey)

        // Only recreate the content if it's a graph, as text will naturally resize
        createDisplayContent(quadrant, displayType, displayKey);
    });
});

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





