const Chart = require('chart.js/auto');
const { time } = require('console');
const { ipcRenderer } = require('electron');

let dataSets;
let startTime;
let replayInterval;
let running = false;
let simple = false; //simplified view
let interval = 100;

function updateSliderLabel(slider, label) {
    label.textContent = slider.value;
    updateLabelPosition(slider, label);
}

function updateLabelPosition(slider, label) {
    const percent = (slider.value - slider.min) / (slider.max - slider.min) * 100;
    label.style.left = `calc(${percent*0.77}% + (${11.5}%))`; // Adjust as needed
}

document.addEventListener('DOMContentLoaded', (event) => {
    const slider = document.getElementById('dataToggleSlider');
    const sliderLabel = document.getElementById('sliderValue');

    // Update label on slider input
    slider.addEventListener('input', () => {
        clearInterval(replayInterval);
        document.getElementById('start-button').disabled = false;
        document.getElementById('stop-button').disabled = true;
        running = false;
        updateSliderLabel(slider, sliderLabel);

        //updates to show the infor at that time
        startTime = new Date();
        let index = document.getElementById('dataset-select').value;
        let dataset = dataSets[index];
        countIndex = 0;
        playData(parseFloat(slider.value), dataset, countIndex)
    });

    // If the slider value is programmatically changed, call this function
    //updateSliderLabel(slider, sliderLabel);
});

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
        maintainAspectRatio: false, // Set this to false to fill the container
        scales: {
            x: {
                beginAtZero: true
            },
            y: {
                beginAtZero: true,
                reverse: true // Invert the y-axis
            }
        },
        animation: {
            duration: 100 // or false
        }
        // ... any additional chart options you'd like to set
    }
};
const ctx = document.getElementById('cpChart').getContext('2d');
const cpChart = new Chart(ctx, chartConfig);

function updateDropdown() {
    let dropdown = document.getElementById('dataset-select');  // Get the dropdown element
    dropdown.innerHTML = '';  // Clear existing options
    dataSets.forEach((dataSet, index) => {
      let option = document.createElement('option');  // Create a new option element
      option.value = index;  // The value will be the index of the dataSet in the dataSets array
      option.text = dataSet.name;  // The text will be the nickname of the dataSet
      dropdown.add(option);  // Add the new option to the dropdown
    });
}

document.getElementById('fileSelect').addEventListener('click', () => {
    ipcRenderer.send('toggle-fileSelect-window');
});

document.getElementById('radioContainer1').addEventListener('change', () => {
    const slider = document.getElementById('dataToggleSlider');
    let index = document.getElementById('dataset-select').value;
    let dataset = dataSets[index];
    let initTime = slider.value;
    startTime = new Date();
    const countIndex = 0;
    if (running) {
        clearInterval(replayInterval);
        replayInterval = setInterval(() => playData(initTime - interval/10000, dataset, countIndex), interval);

    } else {
        
        playData(parseFloat(slider.value), dataset, countIndex)
    }    
})
document.getElementById('radioContainer2').addEventListener('change', () => {
    const slider = document.getElementById('dataToggleSlider');
    let index = document.getElementById('dataset-select').value;
    let dataset = dataSets[index];
    let initTime = slider.value;
    startTime = new Date();
    const countIndex = 0;
    if (running) {
        clearInterval(replayInterval);
        replayInterval = setInterval(() => playData(initTime - interval/10000, dataset, countIndex), interval);

    } else {
        
        playData(parseFloat(slider.value), dataset, countIndex)
    } 
})
document.getElementById('radioContainer3').addEventListener('change', () => {
    const slider = document.getElementById('dataToggleSlider');
    let index = document.getElementById('dataset-select').value;
    let dataset = dataSets[index];
    let initTime = slider.value;
    startTime = new Date();
    const countIndex = 0;
    if (running) {
        clearInterval(replayInterval);
        replayInterval = setInterval(() => playData(initTime - interval/10000, dataset, countIndex), interval);

    } else {
        
        playData(parseFloat(slider.value), dataset, countIndex)
    } 
})

ipcRenderer.on('update-datasets', (event, data) => {
    dataSets = data;
    console.log(dataSets);
    updateDropdown();
    handleChange();
});
ipcRenderer.on('clear-timers', () => {
    clearInterval(replayInterval);
});

document.getElementById('dataset-select').addEventListener('change', handleChange);

function handleChange() {
    console.log('dataset-select changed')
    running = false;
    if (document.getElementById('dataset-select').options.length > 0) {
        document.getElementById('start-button').disabled = false;
        document.getElementById('stop-button').disabled = true;
        document.getElementById('datasetAnalysis').disabled = false;
        
        let index = document.getElementById('dataset-select').value;
        let dataset = dataSets[index];
        console.log(dataset)
        let timeIndex = findIndexOfTitle(dataset.sensors, "time")
        let array = dataset.sensors[timeIndex].array;
        let lastDefinedValue = findLastDefinedValue(array);
        var slider = document.getElementById('dataToggleSlider');
        slider.max = lastDefinedValue;
    } else {
        clearInterval(replayInterval);
        document.getElementById('start-button').disabled = true;
        document.getElementById('stop-button').disabled = true;
        document.getElementById('datasetAnalysis').disabled = true;
    }
}

document.getElementById('start-button').addEventListener('click', handleStart)
document.getElementById('stop-button').addEventListener('click', handleStop)
document.getElementById('datasetAnalysis').addEventListener('click', handleAnalysis);
document.getElementById('simpleView').addEventListener('click', () => {
    const button = document.getElementById('simpleView');
    const elements = document.getElementsByClassName('small-display');

    if (!simple) {
        Array.from(elements).forEach(element => {
            element.style.display = 'none';
        });
        button.innerText = 'Detailed';
        simple = true;
    } else {
        Array.from(elements).forEach(element => {
            element.style.display = 'block';
        });
        button.innerText = 'Simple';
        simple = false;
    }
});

function handleAnalysis() {
    let index = document.getElementById('dataset-select').value;
    ipcRenderer.send('toggle-dataset-analysis-window', index);
}

function handleStart() {
    console.log('replay started')
    const slider = document.getElementById('dataToggleSlider');
    let initTime = slider.value;
    let countIndex = 0;
    startTime = new Date();
    let index = document.getElementById('dataset-select').value;
    let dataset = dataSets[index];
    running = true;
    replayInterval = setInterval(() => playData(initTime - interval/1000, dataset, countIndex), interval);
    document.getElementById('start-button').disabled = true;
    document.getElementById('stop-button').disabled = false;
}

function handleStop() {
    clearInterval(replayInterval);
    running = false;
    document.getElementById('start-button').disabled = false;
    document.getElementById('stop-button').disabled = true;
}

function playData(initTime, dataset, countIndex) {
    var currentTime = new Date();
    var elapsedTime = (currentTime - startTime)/1000; // elaspsed time in seconds
    var dataTime = initTime + elapsedTime;

    const slider = document.getElementById('dataToggleSlider');
    const sliderLabel = document.getElementById('sliderValue');
    slider.value = dataTime;
    updateSliderLabel(slider, sliderLabel);

    let timeIndex = findIndexOfTitle(dataset.sensors, "time")
    let timeWidth = parseFloat(document.getElementById('timeAverage').value);
    leadindex = findIndex(countIndex, dataTime + timeWidth/2,dataset.sensors[timeIndex].array, timeWidth/2)
    leadindexTime = parseFloat(dataset.sensors[timeIndex].array[leadindex]);
    if (dataTime - timeWidth/2 > 0) {
        tailindex = findIndex(countIndex, dataTime - timeWidth/2,dataset.sensors[timeIndex].array, timeWidth/2)
    } else {
        tailindex = 0
    };
    tailindexTime = parseFloat(dataset.sensors[timeIndex].array[tailindex]);

    let approxHz
    if (leadindex - tailindex > 0) {
        approxHz = (leadindex - tailindex)/(leadindexTime - tailindexTime);
        document.body.classList.remove('questionable-data');
    } else {
        approxHz = 0;
        document.body.classList.add('questionable-data');
    }
    document.getElementById('hzDisplay').innerText = approxHz.toFixed(2);
    
    let pitotIndex = findIndexOfTitle(dataset.sensors, "Pitot(m/s)");
    let alphaIndex = findIndexOfTitle(dataset.sensors, "alpha");
    let GPSspeedIndex = findIndexOfTitle(dataset.sensors, "GPS(m/s)");
    let GPSfixIndex = findIndexOfTitle(dataset.sensors, "GPS_fix");
    
    pitotValue = averageSensorData(tailindex,leadindex,dataset.sensors[pitotIndex]);
    if (document.getElementById('vOption').checked) {
        document.getElementById('speedLabel').innerText = 'SPEED (m/s)'
        document.getElementById('speedDisplay').innerText = pitotValue.toFixed(1);
    } else {
        let reynolds = calcReynolds(pitotValue,dataset)
        document.getElementById('speedLabel').innerText = 'Reynolds'
        document.getElementById('speedDisplay').innerText = Math.round(reynolds / 1000) + " k";
    }
    
    alphaValue = averageSensorData(tailindex,leadindex,dataset.sensors[alphaIndex]);
    if (document.getElementById('aoaOption').checked) {
        document.getElementById('aoaLabel').innerText = 'AOA'
        document.getElementById('aoaDisplay').innerText = alphaValue.toFixed(1);
    } else {
        let aAlpha = alphaValue*cosDegrees(parseFloat(dataset.wingSweep))
        document.getElementById('aoaLabel').innerText = 'Adj. AOA'
        document.getElementById('aoaDisplay').innerText = aAlpha.toFixed(1);
    }
    
    document.getElementById('gpsSpeedDisplay').innerText = averageSensorData(tailindex,leadindex,dataset.sensors[GPSspeedIndex]).toFixed(1);
    document.getElementById('gpsFixDisplay').innerText = averageSensorData(tailindex,leadindex,dataset.sensors[GPSfixIndex]).toFixed(0);
    
    let {topPressureData, bottomPressureData, pitot_raw} = formatPressure(dataset.sensors, tailindex, leadindex)
    //console.log({topPressureData, bottomPressureData, pitot_raw})
    const isCP = document.getElementById('cpOption').checked;

    let topData, bottomData;

    if (isCP) {
        // Normalize the pressure values using the pitot pressure
        topData = topPressureData.map(item => ({ x: item.x, y: item.y / pitot_raw }));
        bottomData = bottomPressureData.map(item => ({ x: item.x, y: item.y / pitot_raw }));

        // Set y-axis range for isCP mode
        cpChart.options.scales.y.suggestedMin = -1;
        cpChart.options.scales.y.suggestedMax = 0.6;
    } else {
        topData = topPressureData
        bottomData = bottomPressureData

        // Set y-axis range for the other mode
        cpChart.options.scales.y.suggestedMin = -100;
        cpChart.options.scales.y.suggestedMax = 500;
    }

    // Update the chart's data
    cpChart.data.datasets[0].data = topData;
    cpChart.data.datasets[1].data = bottomData;
    cpChart.update();
    
}

function findIndex(startIndex, targetTime, timeArray, maxDifference) {
    for (let i = startIndex; i < timeArray.length; i++) {
        if (timeArray[i] > targetTime) {
            if ((timeArray[i] - targetTime) > maxDifference) {
                return i - 1;
            }
            return i;
        }
    }
    return timeArray.length - 1; // If no value greater than targetTime is found
}

function findIndexOfTitle(objects, title) {
    return objects.findIndex(obj => obj.title && obj.title.toLowerCase() === title.toLowerCase());
}

function averageSensorData(startIndex, endIndex, sensor) {
    if (!sensor.array || sensor.array.length === 0 || startIndex < 0 || endIndex >= sensor.array.length || startIndex > endIndex) {
        // Invalid input or empty array, return null or throw an error
        return 0;
    }

    let sum = 0;
    for (let i = startIndex; i <= endIndex; i++) {
        sum += parseFloat(sensor.array[i]);
    }
    let average = sum / (endIndex - startIndex + 1);

    if (typeof sensor.calibration === 'number') {
        average -= parseFloat(sensor.calibration);
    }

    return average;
}

function formatPressure(sensors, startIndex, endIndex) {
    //console.log({ sensors, startIndex, endIndex })
    let topPressureData = [];
    let bottomPressureData = [];
    let pitot_raw

    sensors.forEach(sensor => {
        if (sensor.group === 'TOP') {
            let average = averageSensorData(startIndex, endIndex, sensor);
            topPressureData.push({ x: sensor.xpos, y: average });
        } else if (sensor.group === 'BOTTOM') {
            let average = averageSensorData(startIndex, endIndex, sensor);
            bottomPressureData.push({ x: sensor.xpos, y: average });
        } else if (sensor.group === 'PITOT_RAW') {
            pitot_raw = averageSensorData(startIndex, endIndex, sensor);
        }
    });

    return { topPressureData, bottomPressureData, pitot_raw };
}

function findLastDefinedValue(array) {
    for (let i = array.length - 1; i >= 0; i--) {
        if (array[i] !== undefined) {
            return array[i];
        }
    }
    return undefined; // Return undefined if no defined value is found
}

function calcReynolds(pitot, dataSet) {
    console.log("calcReynolds() was called");

    let lengthScale = parseFloat(dataSet.cordLength);
    let airPressure = parseFloat(dataSet.airPressure);
    let airTemperature = parseFloat(dataSet.airTemperature);
    let airDensity = calculateAirDensity(airPressure, airTemperature);
    let wingSweep = parseFloat(dataSet.wingSweep);

    var velocity = pitot*cosDegrees(wingSweep); // extra coefficients are to get in the right units

    // Calculate viscosity using the power-law approximation
    var T = airTemperature + 273.15;
    var A = 1.458e-6;
    var S = 110.4;
    var viscosity = A * Math.pow(T, 1.5) / (T + S);

    var ReynoldsNumber = (airDensity * velocity * lengthScale) / viscosity;
    return ReynoldsNumber
}

function cosDegrees(degrees) {
    let radians = degrees * (Math.PI / 180);
    return Math.cos(radians);
}

function calculateAirDensity(pressure, temperature) {
    const molarMass = 0.02897; // kg/mol
    const gasConstant = 8.314; // J/(mol�K)
    const temperatureInKelvin = temperature + 273.15; // Convert temperature to Kelvin

    const density = (pressure * molarMass) / (gasConstant * temperatureInKelvin);
    return density;
}

window.addEventListener('resize', function() {
    cpChart.resize();
});
