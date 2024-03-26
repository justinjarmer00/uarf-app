let dataSets = [];

window.ipc.on('initialize-dataSets', (data) => {
    console.log(data)
    dataSets = data
    updateDropdown('dataset-select')
});

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

function updateDropdown(id) {
    let dropdown = document.getElementById(id);  // Get the dropdown element
    dropdown.innerHTML = '';  // Clear existing options
    if (id === 'dataset-select'){
        let defaultOption = document.createElement('option');
        defaultOption.value = 'new';
        defaultOption.text = 'New Dataset';
        dropdown.add(defaultOption);
    } else {
        let defaultOption = document.createElement('option');
        defaultOption.value = 'empty';
        defaultOption.text = 'select';
        dropdown.add(defaultOption);
    }
    dataSets.forEach((dataSet, index) => {
      let option = document.createElement('option');  // Create a new option element
      option.value = index;  // The value will be the index of the dataSet in the dataSets array
      option.text = dataSet.name;  // The text will be the nickname of the dataSet
      dropdown.add(option);  // Add the new option to the dropdown
    });
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
    let rowXpos = parseFloat(document.getElementById("coordinates-row").value);
    dataSet.rowCords = rowXpos;
    
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
    let rowCali = parseFloat(document.getElementById("cali-row").value);
    dataSet.rowCali = rowCali;
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
        
        dataSet.sensors.push(sensor);
    }
    
    let userInputTop = document.getElementById("groupTOPRangeInput").value;
    let userInputBottom = document.getElementById("groupBOTTOMRangeInput").value;
    let userInputPP = document.getElementById("groupPPRangeInput").value;
    
    dataSet.topString = userInputTop;
    dataSet.bottomString = userInputBottom;
    dataSet.ppString = userInputPP;
    assignGroupToSensors(dataSet, "TOP", userInputTop);
    assignGroupToSensors(dataSet, "BOTTOM", userInputBottom);
    assignGroupToSensors(dataSet, "PITOT_RAW", userInputPP);

    let coordInputTop = document.getElementById("coordTOPRangeInput").value;
    let coordInputBottom = document.getElementById("coordBOTTOMRangeInput").value;
    dataSet.coordsTopString = coordInputTop;
    dataSet.coordsBottomString = coordInputBottom;
    assignXposToSensors(dataSet, "TOP", coordInputTop, coordsFileContents);
    assignXposToSensors(dataSet, "BOTTOM", coordInputBottom, coordsFileContents);

    // Handle pressure sensor group
    //let pressureSensors = sensorTitleLine.filter(title => !isNaN(title));
    //console.log(pressureSensors)
    // ...handle pressure sensors based on your app's specific requirements...
}

function readFileAsync(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }
        
        let reader = new FileReader();

        reader.onload = function(e) {
            var contents = e.target.result; // Get the file contents
            var lines = contents.split('\n'); // Split the file into lines
            var array = lines.map(function(line) {
                return line.split('\t'); // Split each line into fields
            });
            resolve(array);
        };

        reader.onerror = reject;

        reader.readAsText(file);
    });
}

async function processFiles(mainFile, coordsFile, caliFile, dataSet) {
    try {
        let file1;
        let file2;
        let file3;
        if (!document.getElementById("main-data-file").disabled) {
            file1 = await readFileAsync(mainFile);
            file2 = await readFileAsync(coordsFile);
            file3 = await readFileAsync(caliFile);
            dataSet.mainFile = file1;
            dataSet.coordFile = file2;
            dataSet.caliFile = file3;
        } else {
            file1 = dataSet.mainFile;
            file2 = dataSet.coordFile;
            file3 = dataSet.caliFile;
        }
        autoProcessFiles(dataSet, file1, file2, file3)
        
        console.log(dataSet);
        dataSet.sensors.forEach((sensor) => {
            console.log(sensor.name());
        })
    } catch(err) {
        console.log(err);
    }
}

function createDataSet() {
    //Read Meta Data
    let name = document.getElementById("nickname").value;
    let wingSweep = parseFloat(document.getElementById("wing-sweep").value);
    let airPressure = parseFloat(document.getElementById("air-pressure").value);
    let airTemperature = parseFloat(document.getElementById("air-temperature").value);
    let cordLength = parseFloat(document.getElementById("cord-length").value);

    let dataSet = new DataSet(name, wingSweep, airPressure, airTemperature, cordLength);
    
    if (!document.getElementById("main-data-file").disabled) {
        let mainFile = document.getElementById("main-data-file").files[0];
        let coordsFile = document.getElementById("coordinates-file").files[0];
        let caliFile = document.getElementById("pressure-calibration-file").files[0] ? document.getElementById("pressure-calibration-file").files[0] : null;
        processFiles(mainFile, coordsFile, caliFile, dataSet);
    } else {
        const selectElement = document.getElementById('dataset-select');
        const selectedValue = selectElement.value;
        let dataSetOG = dataSets[selectedValue];
        file1 = dataSetOG.mainFile;
        file2 = dataSetOG.coordFile;
        file3 = dataSetOG.caliFile;
        dataSet.mainFile = file1;
        dataSet.coordFile = file2;
        dataSet.caliFile = file3;
        autoProcessFiles(dataSet, file1, file2, file3)
    }
    return dataSet;
}

function validateInputs() {
    let valid = true;
  
    const mainDataFile = document.getElementById('main-data-file');
    const coordinatesFile = document.getElementById('coordinates-file');
    const calibrationFile = document.getElementById('pressure-calibration-file');
    const allFiles = [mainDataFile, coordinatesFile, calibrationFile];
    
    const pastErrors = document.querySelectorAll('.error');
    pastErrors.forEach(error => error.remove());

    let nickname = document.getElementById("nickname");
    if (nickname.value === ''){
        nickname.style.borderColor = 'red';
        console.log('there was no nickname entered')
        return false;
    }
    for(let i = 0; i < dataSets.length; i++) {
        nickname.style.borderColor = '';
        if(dataSets[i].name === nickname.value && document.getElementById('dataset-select').value == 'new') {
            nickname.value = '';
        return false;
        }
    }

    const metaInputs = document.querySelectorAll(`.meta-inputs`);
    metaInputs.forEach(input => {
    input.style.borderColor = '';
    if (!input.value || input.value == '') {
        input.style.borderColor = 'red';
    }});

    allFiles.forEach(file => {
      if (!file.files[0]) {
        if (file.id === 'pressure-calibration-file') {
          // Calibration file is optional; do not invalidate the form if it is missing.
          return;
        }
        if (file.disabled == true) {
            //this means this is a loaded file... does not need new files
            return
        }
        valid = false;
        const errorMessage = document.createElement('p');
        errorMessage.style.color = 'red';
        errorMessage.className = 'error';  
        errorMessage.textContent = 'This file is required.';
        file.parentElement.appendChild(errorMessage);
      } else if (file.files[0].type !== 'text/plain') {
        valid = false;
        const errorMessage = document.createElement('p');
        errorMessage.style.color = 'red';
        errorMessage.className = 'error';  
        errorMessage.textContent = 'Please upload a text file.';
        file.parentElement.appendChild(errorMessage);
      } else {
        const correspondingNumericInputs = document.querySelectorAll(`.${file.id}-inputs`);
        correspondingNumericInputs.forEach(input => {
        input.style.borderColor = '';
        if (!input.value || input.value == '') {
          input.style.borderColor = 'red';
          valid = false;
        }
      });
      }
    });
  
    return valid;
}

function addDataSet(dataSet) {
    dataSets.push(dataSet);
    updateDropdown('dataset-select');
}
  
function removeDataSet(index) {
    dataSets.splice(index, 1);
    updateDropdown('dataset-select');
}

function loadDataSet(dataSet) {
    document.getElementById("coordinates-row").value = dataSet.rowCords
    
    document.getElementById("groupTOPRangeInput").value = dataSet.topString;
    document.getElementById("groupBOTTOMRangeInput").value = dataSet.bottomString;
    document.getElementById("groupPPRangeInput").value = dataSet.ppString ;

    document.getElementById("coordTOPRangeInput").value = dataSet.coordsTopString;
    document.getElementById("coordBOTTOMRangeInput").value = dataSet.coordsBottomString;

    document.getElementById("cali-row").value = dataSet.rowCali;

    document.getElementById("nickname").value = dataSet.name;
    document.getElementById("wing-sweep").value = dataSet.wingSweep;
    document.getElementById("air-pressure").value = dataSet.airPressure;
    document.getElementById("air-temperature").value = dataSet.airTemperature;
    document.getElementById("cord-length").value = dataSet.cordLength;

    document.getElementById("main-data-file").disabled = true;
    document.getElementById("coordinates-file").disabled = true;
    document.getElementById("pressure-calibration-file").disabled = true;

}

//upload dataSet logic:
const fileInput = document.getElementById('load-dataSet');
fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (!files.length) {
        console.log('No files selected!');
        return;
    }

    Array.from(files).forEach(file => {
        const reader = new FileReader();

        reader.onload = function(event) {
            const fileContent = event.target.result;
            let dataObject;
            try {
                dataObject = JSON.parse(fileContent);
            } catch (error) {
                console.error('Error parsing file:', error);
                return;
            }

            const dataSet = Object.assign(new DataSet(), dataObject);
            dataSet.sensors = []; // empty the sensors array
            loadDataSet(dataSet);
            let file1 = dataSet.mainFile;
            let file2 = dataSet.coordFile;
            let file3 = dataSet.caliFile;
            autoProcessFiles(dataSet, file1, file2, file3);
            addDataSet(dataSet);
            console.log('Data set loaded and sensors rebuilt successfully.');
            console.log(dataSet); // you can inspect the resulting dataSet in the console
            let dropdown = document.getElementById('dataset-select');
            handleNext();
        };

        reader.readAsText(file);
    });
});

document.getElementById('dataset-select').addEventListener('change', handleNext);
document.getElementById('create-update-button').addEventListener('click', handleSubmit);
document.getElementById('discard-delete-button').addEventListener('click', handleDiscard);

document.getElementById('save-dataSet').addEventListener('click', handleSave);

document.getElementById("commit-button").addEventListener('click', () => {
    window.ipc.send('update-datasets', dataSets);
});

function handleNext() {
    console.log('handleNext called')
    const selectElement = document.getElementById('dataset-select');
    const selectedValue = selectElement.value;

    if (selectedValue === 'new') {
        document.getElementById("main-data-file").disabled = false;
        document.getElementById("coordinates-file").disabled = false;
        document.getElementById("pressure-calibration-file").disabled = false;
        document.getElementById("save-dataSet").style.display = 'none';
        document.getElementById("custom-file-upload-div").style.display = 'inline';
        const dataInputSection = document.getElementById('data-form');
        const actionButton = document.getElementById('create-update-button');
        const discardButton = document.getElementById('discard-delete-button');
        document.getElementById('nickname').value = '';

        // Show the form
        dataInputSection.style.display = 'block';
        
        // Set the text for action and discard buttons
        actionButton.textContent = 'Create Dataset';
        discardButton.textContent = 'Discard';
    } else {
        const dataInputSection = document.getElementById('data-form');
        const actionButton = document.getElementById('create-update-button');
        const discardButton = document.getElementById('discard-delete-button');
        document.getElementById("save-dataSet").style.display = 'inline';
        document.getElementById("custom-file-upload-div").style.display = 'none';
        console.log(selectedValue)
        loadDataSet(dataSets[selectedValue])
        // Show the form
        dataInputSection.style.display = 'block';
        
        // Set the text for action and discard buttons
        actionButton.textContent = 'Update Dataset';
        discardButton.textContent = 'Delete';
    }
}

function handleDiscard() {
    const selectElement = document.getElementById('dataset-select');
    const selectedValue = selectElement.value;
    //enable files (if load data set disabled them)
    document.getElementById("main-data-file").disabled = false;
    document.getElementById("coordinates-file").disabled = false;
    document.getElementById("pressure-calibration-file").disabled = false;
    if (selectedValue === 'new'){
    } else {
        removeDataSet(selectedValue);
    }
}

function handleSubmit() {
    const selectElement = document.getElementById('dataset-select');
    const selectedValue = selectElement.value;
    if (selectedValue === 'new'){
        let valid = validateInputs();
        if (valid){
            let newDataSet = createDataSet();
            
            console.log(newDataSet);
            addDataSet(newDataSet);
            //loadFiles(newDataSet);
        } else {
            console.log('invalid sumbmission: could not create data set')
        }
    } else {
        let valid = validateInputs()
        if (valid){
            let updatedDataSet = createDataSet();
            removeDataSet(selectedValue);
            console.log(updatedDataSet);
            addDataSet(updatedDataSet);
        } else {
            console.log('invalid submission: could not update data set')
        }
    }
    handleNext();
}

function handleSave() {
    const selectElement = document.getElementById('dataset-select');
    const selectedValue = selectElement.value;
    let valid = validateInputs()
    if (valid){
        let updatedDataSet = createDataSet();
        removeDataSet(selectedValue);
        console.log(updatedDataSet);
        addDataSet(updatedDataSet);            
        updatedDataSet.saveToFile();
    } else {
        console.log('invalid submission: could not update data set')
    }
    
}
