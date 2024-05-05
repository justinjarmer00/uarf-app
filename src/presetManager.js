const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    loadPresets();
});

function loadPresets() {
    ipcRenderer.send('get-presets');
}

ipcRenderer.on('send-presets', (event, presets) => {
    const presetsDropdown = document.getElementById('presetsDropdown');
    presetsDropdown.innerHTML = '';

    let newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.text = 'New';
    presetsDropdown.appendChild(newOption);

    presets.forEach(preset => {
        let option = document.createElement('option');
        option.value = preset.id;
        option.text = preset.name;
        presetsDropdown.appendChild(option);
    });
});

document.getElementById('savePreset').addEventListener('click', () => {
    const presetId = document.getElementById('presetsDropdown').value;
    let preset;
    if (presetId == 'new'){
        preset = gatherPresetData();
    } else {
        preset = gatherPresetData();
        preset.id = presetId;
    }
    ipcRenderer.send('save-preset', preset);
    location.reload();
});

function openNewPresetDialog() {
    document.getElementById('newPresetDialog').style.display = 'block';
    document.getElementById('newPresetName').value = document.getElementById('presetName').value + " (Copy)";
}

function closeNewPresetDialog() {
    document.getElementById('newPresetDialog').style.display = 'none';
}

function saveNewPreset() {
    let newName = document.getElementById('newPresetName').value;
    if (newName) {
        let preset = gatherPresetData();
        preset.name = newName;
        ipcRenderer.send('save-preset', preset);
        closeNewPresetDialog();
        location.reload();
    }
}

document.getElementById('saveAsNewPreset').addEventListener('click', openNewPresetDialog);

function gatherPresetData() {
    return {
        name: document.getElementById('presetName').value,
        pitotInput: document.getElementById('pitotInput').value,
        topRangeInput: document.getElementById('topRangeInput').value,
        bottomRangeInput: document.getElementById('bottomRangeInput').value,
        topCoordinatesInput: document.getElementById('topCoordinatesInput').value,
        bottomCoordinatesInput: document.getElementById('bottomCoordinatesInput').value,
        wingSweep: document.getElementById('wing-sweep').value,
        airPressure: document.getElementById('air-pressure').value,
        airTemperature: document.getElementById('air-temperature').value,
        cordLength: document.getElementById('cord-length').value,
        unitConversion: document.getElementById('unit-conversion').value,
        calibrationRow: document.getElementById('cali-row').value,
        coordinatesTopRangeInput: document.getElementById('coordTOPRangeInput').value,
        coordinatesBottomRangeInput: document.getElementById('coordBOTTOMRangeInput').value,
        coordinatesRow: document.getElementById('coordinates-row').value
    };
}

document.getElementById('presetsDropdown').addEventListener('change', () => {
    const presetId = document.getElementById('presetsDropdown').value;
    if (presetId === 'new') {
        clearPresetFields();
        document.getElementById('saveAsNewPreset').disabled = true; // Disable the save as new preset button
    } else {
        ipcRenderer.send('load-preset', presetId);
        document.getElementById('saveAsNewPreset').disabled = false; // Enable the save as new preset button
    }
});

ipcRenderer.on('load-preset-response', (event, preset) => {
    if (preset) {
        loadPresetFields(preset);
    }
});

function clearPresetFields() {
    document.getElementById('presetName').value = '';
    document.getElementById('pitotInput').value = '';
    document.getElementById('topRangeInput').value = '';
    document.getElementById('bottomRangeInput').value = '';
    document.getElementById('topCoordinatesInput').value = '';
    document.getElementById('bottomCoordinatesInput').value = '';
    document.getElementById('wing-sweep').value = '';
    document.getElementById('air-pressure').value = '';
    document.getElementById('air-temperature').value = '';
    document.getElementById('cord-length').value = '';
    document.getElementById('unit-conversion').value = '';
    document.getElementById('cali-row').value = '';
    document.getElementById('coordTOPRangeInput').value = '';
    document.getElementById('coordBOTTOMRangeInput').value = '';
    document.getElementById('coordinates-row').value = '';
}

function loadPresetFields(preset) {
    document.getElementById('presetName').value = preset.name;
    document.getElementById('pitotInput').value = preset.pitotInput;
    document.getElementById('topRangeInput').value = preset.topRangeInput;
    document.getElementById('bottomRangeInput').value = preset.bottomRangeInput;
    document.getElementById('topCoordinatesInput').value = preset.topCoordinatesInput;
    document.getElementById('bottomCoordinatesInput').value = preset.bottomCoordinatesInput;
    document.getElementById('wing-sweep').value = preset.wingSweep;
    document.getElementById('air-pressure').value =preset.airPressure;
    document.getElementById('air-temperature').value = preset.airTemperature;
    document.getElementById('cord-length').value = preset.cordLength;
    document.getElementById('unit-conversion').value = preset.unitConversion;
    document.getElementById('cali-row').value = preset.calibrationRow;
    document.getElementById('coordTOPRangeInput').value = preset.coordinatesTopRangeInput;
    document.getElementById('coordBOTTOMRangeInput').value = preset.coordinatesBottomRangeInput;
    document.getElementById('coordinates-row').value = preset.coordinatesRow;
    // Add more fields as needed
    // Make sure these fields are returned by the server
}

document.getElementById('deletePreset').addEventListener('click', () => {
    const presetId = document.getElementById('presetsDropdown').value;
    ipcRenderer.send('delete-preset', presetId);
    location.reload();
});
