
const MODE = 'demo'; // Change to 'api' when ESP32 API is ready
const API_BASE = '/api';
const STORAGE_KEY = 'smartMedicineBoxDemoV1';

let medicines = MODE === 'demo' ? loadMedicines() : [];
let editingId = null;

const form = document.getElementById('medicineForm');
const nameInput = document.getElementById('medicineName');
const timeInput = document.getElementById('medicineTime');
const rows = document.getElementById('medicineRows');
const feedback = document.getElementById('feedback');

// ---------------- DEMO STORAGE ----------------

function loadMedicines() {
  try {
    const value = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || '[]'
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveMedicines() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(medicines));
}

function message(text) {
  feedback.textContent = text;
}

function resetForm() {
  editingId = null;
  form.reset();

  document.getElementById('saveBtn').textContent =
    'Add Medicine';

  document.getElementById('cancelBtn')
    .classList.add('hidden');
}

// ---------------- DISPLAY MEDICINES ----------------

function render() {
  rows.replaceChildren();

  document.getElementById('total').textContent =
    medicines.length;

  document.getElementById('pending').textContent =
    medicines.filter(m => m.status === 'Pending').length;

  document.getElementById('taken').textContent =
    medicines.filter(m => m.status === 'Taken').length;

  document.getElementById('emptyState')
    .classList.toggle('hidden', medicines.length > 0);

  for (const m of medicines) {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = m.name;

    const tdTime = document.createElement('td');
    tdTime.textContent = m.time;

    const tdStatus = document.createElement('td');
    const pill = document.createElement('span');

    pill.className =
      'pill ' + (m.status === 'Taken' ? 'taken' : 'pending');

    pill.textContent = m.status;
    tdStatus.append(pill);

    const tdActions = document.createElement('td');
    tdActions.className = 'actions';

    const actions = [
      ['Edit', 'edit', () => startEdit(m.id)],
      ['Delete', 'delete', () => removeMedicine(m.id)]
    ];

    // Physical button confirms doses in API Mode
    if (MODE === 'demo' && m.status !== 'Taken') {
      actions.unshift([
        'Mark Taken',
        'confirm',
        () => markTaken(m.id)
      ]);
    }

    for (const [label, cls, fn] of actions) {
      const button = document.createElement('button');

      button.type = 'button';
      button.className = cls;
      button.textContent = label;
      button.addEventListener('click', fn);

      tdActions.append(button);
    }

    tr.append(tdName, tdTime, tdStatus, tdActions);
    rows.append(tr);
  }
}

// ---------------- REST API FUNCTIONS ----------------

// GET medicines
async function getMedicines() {
  const response = await fetch(`${API_BASE}/medicines`);

  if (!response.ok) {
    throw new Error('GET medicines failed');
  }

  return await response.json();
}

// POST medicine
async function addMedicineAPI(name, time) {
  const response = await fetch(`${API_BASE}/medicines`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, time })
  });

  if (!response.ok) {
    throw new Error('POST medicine failed');
  }

  return response;
}

// PUT medicine
async function updateMedicineAPI(id, name, time) {
  const response = await fetch(
    `${API_BASE}/medicines/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, time })
    }
  );

  if (!response.ok) {
    throw new Error('PUT medicine failed');
  }

  return response;
}

// DELETE medicine
async function deleteMedicineAPI(id) {
  const response = await fetch(
    `${API_BASE}/medicines/${encodeURIComponent(id)}`,
    {
      method: 'DELETE'
    }
  );

  if (!response.ok) {
    throw new Error('DELETE medicine failed');
  }
}

// GET temperature and humidity
async function getReadings() {
  const response = await fetch(`${API_BASE}/readings`);

  if (!response.ok) {
    throw new Error('GET readings failed');
  }

  return await response.json();
}

// GET box status
async function getBoxStatus() {
  const response = await fetch(`${API_BASE}/status`);

  if (!response.ok) {
    throw new Error('GET status failed');
  }

  return await response.json();
}

// ---------------- ADD / EDIT ----------------

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const time = timeInput.value;

  if (!name || !time) return;

  try {
    if (MODE === 'api') {
      if (editingId !== null) {
        await updateMedicineAPI(editingId, name, time);
        message('Medicine updated.');
      } else {
        await addMedicineAPI(name, time);
        message('Medicine added.');
      }

      medicines = await getMedicines();
    } else {
      if (editingId !== null) {
        const medicine = medicines.find(
          m => m.id === editingId
        );

        if (medicine) {
          medicine.name = name;
          medicine.time = time;
          message('Medicine updated (demo).');
        }
      } else {
        medicines.push({
          id: crypto.randomUUID(),
          name,
          time,
          status: 'Pending'
        });

        message('Medicine added (demo).');
      }

      saveMedicines();
    }

    resetForm();
    render();
  } catch (error) {
    message('Error: ' + error.message);
  }
});

// ---------------- EDIT BUTTON ----------------

function startEdit(id) {
  const medicine = medicines.find(m => m.id === id);

  if (!medicine) return;

  editingId = id;
  nameInput.value = medicine.name;
  timeInput.value = medicine.time;

  document.getElementById('saveBtn').textContent =
    'Save Changes';

  document.getElementById('cancelBtn')
    .classList.remove('hidden');

  nameInput.focus();
}

// ---------------- DELETE BUTTON ----------------

async function removeMedicine(id) {
  if (!confirm('Delete this medicine?')) return;

  try {
    if (MODE === 'api') {
      await deleteMedicineAPI(id);
      medicines = await getMedicines();
      message('Medicine deleted.');
    } else {
      medicines = medicines.filter(m => m.id !== id);
      saveMedicines();
      message('Medicine deleted (demo).');
    }

    resetForm();
    render();
  } catch (error) {
    message('Error: ' + error.message);
  }
}

// ---------------- MARK TAKEN (DEMO ONLY) ----------------

function markTaken(id) {
  if (MODE !== 'demo') return;

  const medicine = medicines.find(m => m.id === id);

  if (!medicine) return;

  medicine.status = 'Taken';

  saveMedicines();
  render();

  message('Dose marked taken (demo only).');
}

// ---------------- REFRESH MEDICINES ----------------

async function refreshMedicines() {
  if (MODE !== 'api') return;

  try {
    medicines = await getMedicines();
    render();
  } catch (error) {
    message('Error loading medicines: ' + error.message);
  }
}

// ---------------- SENSOR AND BOX STATUS ----------------

async function refreshSensorAndStatus() {
  if (MODE !== 'api') return;

  try {
    const readings = await getReadings();
    const status = await getBoxStatus();

    document.getElementById('temperature').textContent =
      readings.temperature + ' °C';

    document.getElementById('humidity').textContent =
      readings.humidity + ' %';

    document.getElementById('boxStatus').textContent =
      status.box;

    document.getElementById('alarmStatus').textContent =
      'Alarm: ' + (status.alarm ? 'ON' : 'OFF');

  } catch (error) {
    message('Error loading sensor/status: ' + error.message);
  }
}

// ---------------- INITIALIZE DASHBOARD ----------------

document.getElementById('cancelBtn')
  .addEventListener('click', resetForm);

// Display correct mode
document.querySelector('header .status').textContent =
  MODE === 'demo' ? '● Demo Mode' : '● API Mode';

if (MODE === 'api') {
  document.querySelector('.hint').textContent =
    'Medicine schedules are stored on ESP32.';

  document.getElementById('environmentStatus').textContent =
    'Live sensor readings';

  refreshMedicines();
  refreshSensorAndStatus();

  setInterval(refreshMedicines, 5000);
  setInterval(refreshSensorAndStatus, 5000);
}

render();
