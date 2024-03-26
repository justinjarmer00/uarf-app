let dataSet
let sensors = [];
let startEnd = [undefined,undefined];

class Sensor {
    constructor(title, array, time, index, xpos, calibration, conversion) {
        this.title = title;
        this.array = array;
        this.time = time;
        this.index = index;
        this.xpos = xpos;
        this.calibration = calibration;
        this.conversion = conversion;
        this.group;
    }

    name() {
        if (this.group) {
            return this.xpos ? `${this.title}\t${this.group}\t${this.xpos}` : `${this.index}\t${this.group}`;
        } else {
            return `${this.title}`;
        }
    }

    average(start,end) {
        this.conversion = this.conversion ? this.conversion : 1;
        let columnAvg = 0;
        let length = 0;
        if (start == undefined){
            start = 0;
        };
        if (end == undefined){
            end = this.array.length;
        };
        for (let i = start; i < Math.min(this.array.length, end); i ++){
            columnAvg += this.array[i] ? this.array[i]*this.conversion : 0; //conversion included
            length += this.array[i] ? 1: 0;                 
        }
        columnAvg = columnAvg/(length); 
        return columnAvg
    }

    errorbars(start,end) {
        try {
            this.conversion = this.conversion ? this.conversion : 1;
            let array = [];
            if (start == undefined){
                start = 0;
            };
            if (end == undefined){
                end = this.array.length;
            };
            for (let i = start; i < Math.min(this.array.length, end); i ++){
                this.array[i] && array.push(this.array[i]*this.conversion);                 
            }
            //console.log(array)
            let columnError = jStat.stdev(array);
            //console.log(columnError);
            let confidenceLevel = document.getElementById('confidence').value
            let alpha = 1 - confidenceLevel/100;
            let z = jStat.normal.inv(1 - alpha/2, 0, 1);
            //console.log(z);
            return z*columnError;
        } catch {
            console.log("error using jStat library");
            return 1;
        }
        
    }

    percentError(start, end) {
        try {
            this.conversion = this.conversion ? this.conversion : 1;
            let array = [];
            if (start == undefined){
                start = 0;
            };
            if (end == undefined){
                end = this.array.length;
            };
            for (let i = start; i < Math.min(this.array.length, end); i ++){
                this.array[i] && array.push(this.array[i]*this.conversion);                 
            }
            return jStat.stdev(array)/this.average(start,end);
        } catch {
            console.log("error using jStat library");
            return 0;
        }
    }

    data() {
        this.conversion = this.conversion ? this.conversion : 1;
        return this.array.map(value => value * this.conversion)
    }

    cali() {
        this.conversion = this.conversion ? this.conversion : 1;
        return this.calibration ? this.calibration*this.conversion : 0
    }
}

class DataSet {
    constructor(name, wingSweep, airPressure, airTemperature, cordLength) {
      this.name = name;
      this.start;
      this.end;
      this.wingSweep = wingSweep;
      this.airPressure = airPressure;
      this.airTemperature = airTemperature;
      this.cordLength = cordLength;
      this.mainFile;
      this.coordFile;
      this.caliFile;
      this.topString;
      this.bottomString;
      this.ppString;
      this.coordsTopString;
      this.coordsBottomString
      this.rowCords;
      this.rowCali;
      this.sensors = [];
    }

    saveToFile() {
        let filename = this.name + '_cpfe2ds.json';
        const dataString = JSON.stringify(this, null, 2); // stringify with pretty print
        this.download(filename, dataString);
    }
    
    download(filename, text) {
        var element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);

        element.style.display = 'none';
        document.body.appendChild(element);

        element.click();

        document.body.removeChild(element);
    }
}

window.ipc.on('dataset', (data) => {
    console.log(data)
    document.getElementById('windowTitle').innerText = '"' + data.name + '" Dataset Analysis'
    const dataset = Object.assign(new DataSet(), data);
    console.log(dataset)
    dataset.sensors = []; // empty the sensors array
    let file1 = dataset.mainFile;
    let file2 = dataset.coordFile;
    let file3 = dataset.caliFile;
    console.log('decomposed given dataset')
    autoProcessFiles(dataset, file1, file2, file3);
    dataSet = dataset;
    console.log('Data set loaded and sensors rebuilt successfully.');
    console.log(dataSet); // you can inspect the resulting dataSet in the console
    handleChange();
});

function autoProcessFiles(dataSet, mainFileContents, coordsFileContents, caliFileContents) {
    // Initialize sensor title and data start line
    let sensorTitleLine = null;
    let dataStartLine = null;

    // Function to check if a string can be converted to a number or is 'N/A'
    function isNumberOrNA(str) {
        return !isNaN(str) || str === 'N/A';
    }

    // Find the sensor title line and data start line
    for (let i = 0; i < mainFileContents.length; i++) {
        let allNumbersOrNA = mainFileContents[i].every(isNumberOrNA);
        if (allNumbersOrNA && sensorTitleLine === null) {
            sensorTitleLine = mainFileContents[i - 1];
            dataStartLine = i;
            break;
        }
    }

    // Ensure that sensor title line and data start line were found
    if (sensorTitleLine === null || dataStartLine === null) {
        console.error("Unable to determine sensor title line and/or data start line.");
        return;
    }

    // Parse sensors
    rowCali = dataSet.rowCali 
    for (let i = 0; i < sensorTitleLine.length; i++) {
        let sensorTitle = sensorTitleLine[i].trim();
        let sensorData = mainFileContents.slice(dataStartLine).map(line => line[i]);
        let time = "N/A";
        let calibration;
        if (parseFloat(sensorTitle)){
            calibration = caliFileContents ? parseFloat(caliFileContents[rowCali][sensorTitle - 1]) : 0;
        } else {
            console.log("title not a number");
        }
        let sensor = new Sensor(sensorTitle, sensorData, time, "N/A", "N/A", calibration);
        //console.log(sensor.data())
        dataSet.sensors.push(sensor);
    }
    console.log('made it past the sensor jinit')

    let userInputTop = dataSet.topString;
    let userInputBottom = dataSet.bottomString;
    let userInputPP = dataSet.ppString;
    assignGroupToSensors(dataSet, "TOP", userInputTop);
    assignGroupToSensors(dataSet, "BOTTOM", userInputBottom);
    assignGroupToSensors(dataSet, "PITOT_RAW", userInputPP);
    console.log('made it past the group assignments')

    let coordInputTop = dataSet.coordsTopString;
    let coordInputBottom = dataSet.coordsBottomString;
    assignXposToSensors(dataSet, "TOP", coordInputTop, coordsFileContents);
    assignXposToSensors(dataSet, "BOTTOM", coordInputBottom, coordsFileContents);
    console.log('made it past the xpos assignments')

    // Handle pressure sensor group
    //let pressureSensors = sensorTitleLine.filter(title => !isNaN(title));
    //console.log(pressureSensors)
    // ...handle pressure sensors based on your app's specific requirements...
}

document.getElementById('data-select').addEventListener('change', function() {
    displaySensors();
    sensorsHist();
});

document.getElementById('bins-mode-select').addEventListener('change', () => sensorsHist());
document.getElementById('bins-input').addEventListener('change', () => sensorsHist());

window.addEventListener('resize', function() {
    Plotly.relayout('velocity-plot', {
        autosize: true
    });
    Plotly.relayout('alpha-plot', {
        autosize: true
    });
    Plotly.relayout('pressure-plot', {
        autosize: true
    });
    Plotly.relayout('stDevTop-plot', {
        autosize: true
    });
    Plotly.relayout('stDevBot-plot', {
        autosize: true
    });
    Plotly.relayout('cp-plot', {
        autosize: true
    });
    Plotly.relayout('tSeries-plot', {
        autosize: true
    });
    Plotly.relayout('hist-plot', {
        autosize: true
    });
});

function getColumn(data, startRow, colIndex, single) {
    // Make sure startRow and colIndex are within the valid range
    if (startRow < 0 || startRow >= data.length || colIndex < 0 || colIndex >= data[startRow].length) {
        console.log("start row or column out of array index");
        console.log(`start row ${startRow}\t${data.length}\ncolumn ${colIndex}\n${data[startRow].length}`)
        return [];
    }
    // Use the slice method to start from the startRow, then use the map method to extract the colIndex
    return single ? [data[startRow][colIndex]] : data.slice(startRow).map(row => row[colIndex]);
}

function handleChange(){
    console.log('handleChange() was called')
    sensors = [];
    plotsRawPressure();
    plotsMainCP();
    plotsVandA();
    initializeRangeInput();
    createSensors();
    displaySensors();
    sensorsHist();    

    //activate range selector listeners
    try {
        //plots
        document.getElementById(`alpha-plot`).removeListener('plotly_relayout', (eventdata) => handleRelayoutAlpha(eventdata,'plot'));
        document.getElementById(`alpha-plot`).on('plotly_relayout', (eventdata) => handleRelayoutAlpha(eventdata,'plot'));
        //inputs
        document.getElementById(`left`).removeEventListener('change', (eventdata) => handleRelayoutAlpha(eventdata,'input'))
        document.getElementById(`right`).removeEventListener('change', (eventdata) => handleRelayoutAlpha(eventdata,'input'))
        document.getElementById(`left`).addEventListener('change', (eventdata) => handleRelayoutAlpha(eventdata,'input'))
        document.getElementById(`right`).addEventListener('change', (eventdata) => handleRelayoutAlpha(eventdata,'input'))
        //error CP
        document.getElementById('error-switch').removeEventListener('change', () => plotsMainCP());
        document.getElementById('error-switch').addEventListener('change', () => plotsMainCP());
        document.getElementById('confidence').removeEventListener('change', () => plotsMainCP());
        document.getElementById('confidence').addEventListener('change', () => plotsMainCP());
    } catch {
        //plots
        document.getElementById(`alpha-plot`).on('plotly_relayout', (eventdata) => handleRelayoutAlpha(eventdata,'plot'));
        //inputs
        document.getElementById(`left`).addEventListener('change', (eventdata) => handleRelayoutAlpha(eventdata,'input'))
        document.getElementById(`right`).addEventListener('change', (eventdata) => handleRelayoutAlpha(eventdata,'input'))
        //error CP
        document.getElementById('error-switch').addEventListener('change', () => plotsMainCP());
        document.getElementById('confidence').addEventListener('change', () => plotsMainCP());
    }

    //plotsRawPressure(index,startEnd) is called in the event listeners above  
}

function parseUserInput(input) {
    let ranges = input.split(',').map(range => {
        if (range.includes(':')) {
            return range.split(':').map(Number);
        } else {
            // if a single number, return it as both the start and end of a range
            return [Number(range), Number(range)];
        }
    });
    return ranges;
}

function assignGroupToSensors(dataSet, groupName, userInput) {
    let ranges = parseUserInput(userInput);
    let groupIndex = 0; // Add groupIndex to keep track of the sensor's position in the group

    for (let range of ranges) {
        for (let i = range[0]; i <= range[1]; i++) {
            let sensor = dataSet.sensors.find(sensor => sensor.title == i.toString());
            if (sensor) {
                sensor.group = groupName;
                sensor.index = groupIndex; // Assign groupIndex to the sensor
                groupIndex++; // Increment groupIndex
            }
        }
    }
}

function assignXposToSensors(dataSet, groupName, coordInput, coordsFileContents) {
    // Find sensors that belong to the specified group and sort them by their index
    let sensorsInGroup = dataSet.sensors
        .filter(sensor => sensor.group === groupName)
        .sort((a, b) => a.index - b.index);

    // Parse the coordinate range input
    rowXpos = dataSet.rowCords
    let coordRanges = parseUserInput(coordInput);
    let coords = [];

    // Iterate over the coordinate ranges and push the corresponding coordinates to the coords array
    for (let range of coordRanges) {
        for (let i = range[0]; i <= range[1]; i++) {
            coords.push(coordsFileContents[rowXpos][i - 1]);  // Subtract 1 because file content array is 0-indexed
        }
    }

    // Assign the coordinate to the corresponding sensor
    for (let i = 0; i < sensorsInGroup.length; i++) {
        sensorsInGroup[i].xpos = parseFloat(coords[i]);
    }
}

function createSensors(){
    dataSet.sensors.forEach((sensor) => {
        addSensor(sensor);
    });
}

function addSensor(sensor){
    sensors.push(sensor);
    updateSensorDropdown(`data-select`);
}

function updateSensorDropdown(id){
    let dropdown = document.getElementById(id);
    dropdown.innerHTML = '';

    //loop through sensors
    sensors.forEach((sensor, pos) => {
        let option = document.createElement('option');  // Create a new option element
        option.text = sensor.name();  // The text will be the nickname of the dataSet
        option.value = pos;
        dropdown.add(option);  // Add the new option to the dropdown
      });
}

function plotsVandA(){
    console.log('plotsVandA() was called')
    start = startEnd[0];
    end = startEnd[1];

    let alphaSensor = dataSet.sensors.find(object => object.title === "Alpha");
    let pitotSensor = dataSet.sensors.find(object => object.title === "Pitot(m/s)");
    let gpsSensor = dataSet.sensors.find(object => object.title === "GPS(m/s)");

    let alphaData = [prepDataSingle(alphaSensor, 'line', start, end)];
    let pitotData = prepDataSingle(pitotSensor, 'line', start, end);
    let gpsData = prepDataSingle(gpsSensor, 'line', start, end);
    let velocityData = [pitotData, gpsData];
    console.log(velocityData)
    
    var alphaLayout = {
        title: 'Alpha',
        xaxis: {
            //rangeselector: selectorOptions,
            rangeslider: {}
        },
        yaxis: {
            //fixedrange: true
        },
        autosize: true,
        responsive: true
    };
    var speedLayout = {
        title: 'Velocity',
        xaxis: {
            //rangeselector: selectorOptions,
            rangeslider: {}
        },
        yaxis: {
            //fixedrange: true
        },
        autosize: true,
        responsive: true
    };
    
    Plotly.newPlot(`velocity-plot`, velocityData, speedLayout);
    Plotly.newPlot(`alpha-plot`, alphaData, alphaLayout);
}

function plotsRawPressure(){
    start = startEnd[0];
    end = startEnd[1];
    console.log('plotsRawPressure() was called');
    //get range values
    let topArray = dataSet.sensors.filter(object => object.group === "TOP");
    topArray.sort((a, b) => a.index - b.index);

    let bottomArray = dataSet.sensors.filter(object => object.group === "BOTTOM");
    bottomArray.sort((a, b) => a.index - b.index);

    topPressureData =  prepRawDataArray(topArray, 'line', start, end);
    bottomPressureData = prepRawDataArray(bottomArray, 'line', start, end);
    
    pressureData = [topPressureData[0], bottomPressureData[0], topPressureData[1], bottomPressureData[1]]
    console.log(pressureData);
    var rawPressureTaps = {
        title: 'Raw pressure',
        xaxis: {
            //rangeselector: selectorOptions,
            //rangeslider: {}
        },
        yaxis: {
            autorange: 'reversed'
            //fixedrange: true
        },
        autosize: true,
        responsive: true
    };

    //initialize layout
    var stDevTopLayout = {
        title: 'stdev of top pressure taps',
        xaxis: {
            //rangeselector: selectorOptions,
            //rangeslider: {}
        },
        yaxis: {
            //fixedrange: true
        },
        autosize: true,
        responsive: true
    };

    var stDevBotLayout = {
        title: 'stdev of bottom pressure taps',
        xaxis: {
            //rangeselector: selectorOptions,
            //rangeslider: {}
        },
        yaxis: {
            //fixedrange: true
        },
        autosize: true,
        responsive: true
    };

    Plotly.newPlot(`pressure-plot`, pressureData, rawPressureTaps);

    //make charts
    Plotly.newPlot(`stDevTop-plot`, [topPressureData[2]], stDevTopLayout);
    Plotly.newPlot(`stDevBot-plot`, [bottomPressureData[2]], stDevBotLayout);
}

function prepDataSingle(sensor, mode, start, end) {
    //account for missing information;
    if (start == undefined){
        start = 0;
    }
    if (end == undefined){
        end = sensor.array.length;
    };

    //initialize
    var x = [];

    for (i = start; i < sensor.array.length; i++){
        try {
            x.push(i);
        } catch {
            console.log('could not data to float for: ' + sensor.name());
        }
    }
    return {
        mode: mode,
        x: x,
        y: sensor.data(),
        name: sensor.name()
    };
}

function prepRawDataArray(sensorArray, mode, start, end) {
    //this data is like the pressure taps over the top (multiple columns)
    //this means that we will plot against somthing else than index
    
    let x = [];
    let y = [];
    let yError = [];
    let ycali = [];
    let sensorError = [];
    let sensorIndex = [];

    sensorArray.forEach((sensor, index) => {
        y.push(sensor.average(start,end))
        x.push(sensor.xpos)
        yError.push(sensor.errorbars(start,end))
        ycali.push(sensor.cali())
        sensorError.push(sensor.percentError())
        sensorIndex.push(index)
    })

    var vis;
    if (document.getElementById('error-switch').checked){
        vis = true;
    } else {
        vis = false;
    }

    return [{
        mode: mode,
        x: x,
        y: y,
        name: sensorArray[0].group,
        error_y: {
            type: 'data',
            array: yError,
            visible: vis
        }
    },
    {
        mode: mode,
        x: x,
        y: ycali,
        name: sensorArray[0].group + " Calibration"
    },{
        mode: mode,
        x: x,
        y: sensorError,
        name: sensorArray[0].group + " % Error"
    }];
}

function prepCP(pitotSensor, sensorArray, mode, name, start, end) {
    let x = [];
    let y = [];
    let yError = [];
    console.log(pitotSensor.average(start,end))
    sensorArray.forEach((sensor) => {
        console.log(sensor.average(start,end))
        console.log(sensor.cali())
        y.push((sensor.average(start,end) - sensor.cali())/pitotSensor.average(start,end))
        x.push(sensor.xpos)
        yError.push(sensor.errorbars(start,end)/pitotSensor.average(start,end))
    })

    var vis;
    if (document.getElementById('error-switch').checked){
        vis = true;
    } else {
        vis = false;
    }
    console.log(vis);

    return {
        mode: mode,
        x: x,
        y: y,
        name: name,
        error_y: {
            type: 'data',
            array: yError,
            visible: vis
        }
    }
}

function plotsMainCP(){
    console.log('plotsMainCP() was called');
    var topPressureData1 = {};
    var bottomPressureData1 = {};
    let mode = 'line';

    let topArray = dataSet.sensors.filter(object => object.group === "TOP");
    topArray.sort((a, b) => a.index - b.index);

    let bottomArray = dataSet.sensors.filter(object => object.group === "BOTTOM");
    bottomArray.sort((a, b) => a.index - b.index);

    let pitotRaw = dataSet.sensors.find(object => object.group === "PITOT_RAW");
    var reynolds1 = calcReynolds(dataSet, startEnd[0], startEnd[1]);
    var nameEnd1 = " Reynolds Number: " + reynolds1;

    topPressureData1 = prepCP(pitotRaw, topArray, mode, dataSet.name + ": Top Surface" + nameEnd1, startEnd[0],startEnd[1]);
    bottomPressureData1 = prepCP(pitotRaw, bottomArray, mode, dataSet.name + ": Bottom Surface" + nameEnd1, startEnd[0],startEnd[1]);

    console.log('completed data calculations')

    var pressureData = [topPressureData1, bottomPressureData1]
    console.log(pressureData);

    var mainCPlayout = {
        title: 'CP',
        xaxis: {
            //rangeselector: selectorOptions,
            //rangeslider: {}
        },
        yaxis: {
            autorange: 'reversed'
            //fixedrange: true
        },
        legend: {
            x: 0.5, 
            y: 0, // Play with this value
            xanchor: 'center',
            yanchor: 'bottom',
            traceorder: 'normal',
            font: {
                family: 'sans-serif',
                size: 12,
                color: '#000'
            },
            bgcolor: '#E2E2E2',
            bordercolor: '#FFFFFF',
            borderwidth: 2
        },
        margin: {
          t: 50, // top margin
          l: 50, // left margin
          r: 50, // right margin
          b: 100, // bottom margin, you may need to increase it
        },
        autosize: true,
        responsive: true
    };

    Plotly.newPlot(`cp-plot`, pressureData, mainCPlayout);
}

function displaySensors() {
    console.log('display sensors was called')
    console.log(sensors)
    console.log(document.getElementById(`data-select`).value)
    let sensor = sensors[document.getElementById(`data-select`).value];

    let sensorData = {
        mode: 'line',
        y: sensor.data(), 
        name: "Sensor Reading"
    }

    let sensorCali = {
        mode: 'line',
        y: sensor.data().map(value => sensor.cali()),
        name: "Sensor Calibration"
    }

    

    let sensorLayout = {
        title: sensor.name(),
        xaxis: {
            //rangeselector: selectorOptions,
            //rangeslider: {}
        },
        yaxis: {
            //fixedrange: true
        }
    };
    console.log(`tSeries-plot`, [sensorData,sensorCali], sensorLayout)
    Plotly.newPlot(`tSeries-plot`, [sensorData,sensorCali], sensorLayout);
}

function sensorsHist() {
    let sensor = sensors[document.getElementById(`data-select`).value];

    let binsMode = document.getElementById(`bins-mode-select`);
    let numberBins = document.getElementById(`bins-input`);

    let histData;

    if (binsMode.value === "true") {
        histData = {
            x: sensor.data(),
            type: 'histogram',
            autobinx: true
        }
    } else {
        histData = {
            x: sensor.data(),
            type: 'histogram',
            xbins: {
                start: Math.min(...sensor.data),
                end: Math.max(...sensor.data),
                size: (Math.max(...sensor.data) - Math.min(...sensor.data)) / parseFloat(numberBins.value)
            }
        }
    }

    let histLayout = {
        title: sensor.name(),
        xaxis: {title: 'value'},
        yaxis: {title: 'frequency'},
        autosize: true,
        responsive: true
    }

    Plotly.newPlot(`hist-plot`, [histData], histLayout);
}

//Plot listeners
function handleRelayoutAlpha(eventdata, type) {
    //console.log(eventdata['xaxis.range'][0]);
    if (type == 'plot'){
        Plotly.relayout(document.getElementById(`velocity-plot`), {'xaxis.range': [eventdata['xaxis.range'][0], eventdata['xaxis.range'][1]]});
        
        try {
            console.log(eventdata['xaxis.range'][0])
            console.log(eventdata['xaxis.range'][1])
            startEnd = [Math.floor(eventdata['xaxis.range'][0]),Math.ceil(eventdata['xaxis.range'][1])];
        } catch {
            startEnd = [undefined,undefined];
            console.log('could not read rangeselector')
        }
        console.log(startEnd)
        document.getElementById(`leftDis`).value = Math.floor(eventdata['xaxis.range'][0]);
        document.getElementById(`rightDis`).value = Math.ceil(eventdata['xaxis.range'][1]);
        plotsRawPressure();
        plotsMainCP();
        createSensors(startEnd);
    }
    if (type == 'input') {
        console.log('i did get here');
        let left = document.getElementById(`left`).value;
        let right = document.getElementById(`right`).value;
        console.log(left);
        console.log(right);
        Plotly.relayout(document.getElementById(`alpha-plot`), {'xaxis.range': [left, right]});
        document.getElementById(`leftDis`).value = left;
        document.getElementById(`rightDis`).value = right;
    }

}

function calcReynolds(dataSet, start, end) {
    console.log("calcReynolds() was called");

    let lengthScale = parseFloat(dataSet.cordLength);
    let airPressure = parseFloat(dataSet.airPressure);
    let airTemperature = parseFloat(dataSet.airTemperature);
    let airDensity = calculateAirDensity(airPressure, airTemperature);
    
    let pitotRaw = dataSet.sensors.find(object => object.group === "PITOT_RAW");

    let pitot = pitotRaw.average(start,end) - pitotRaw.cali();
    let wingSweep = parseFloat(dataSet.wingSweep);

    var velocityAvg = Math.sqrt((2 * (pitot) * (249.09 / 1000)) / airDensity)*cosDegrees(wingSweep); // extra coefficients are to get in the right units

    // Calculate viscosity using the power-law approximation
    var T = airTemperature + 273.15;
    var A = 1.458e-6;
    var S = 110.4;
    var viscosity = A * Math.pow(T, 1.5) / (T + S);

    var ReynoldsNumber = (airDensity * velocityAvg * lengthScale) / viscosity;
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

function initializeRangeInput(){
    document.getElementById(`left`).value = 0;
    document.getElementById(`right`).value = dataSet.sensors[0].array.length;
    document.getElementById(`left`).min= 0;
    document.getElementById(`right`).max = dataSet.sensors[0].array.length;
}