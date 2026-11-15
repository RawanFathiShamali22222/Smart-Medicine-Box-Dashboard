
const MODE = 'demo'; // Change to 'api' when backend is ready
const API_BASE = 'http://COMPUTER_IP:3000/api';
const STORAGE_KEY = 'smartMedicineBoxDemoV2';

let medicines = MODE === 'demo' ? loadMedicines() : [];
let editingId = null;

const form = document.getElementById('medicineForm');
const nameInput = document.getElementById('medicineName');
const doseInput = document.getElementById('medicineDose');
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

// ---------------- DISPLAY ----------------

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

  const dueMedicines = medicines.filter(
    m => m.status === 'Due'
  );

  const dueBanner = document.getElementById('dueBanner');
  const dueMessage = document.getElementById('dueMessage');

  dueBanner.classList.toggle(
    'hidden',
    dueMedicines.length === 0
  );

  dueMessage.textContent = dueMedicines
    .map(m => `Time to take ${m.name} - ${m.dose || ''}`)
    .join(' | ');

  for (const m of medicines) {
    const tr = document.createElement('tr');

    for (const value of [
      m.name,
      m.dose || '',
      m.time
    ]) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }

    const tdStatus = document.createElement('td');
    const pill = document.createElement('span');

    const status = m.status || 'Pending';
    const statusClass = ['Pending', 'Due', 'Taken', 'Missed']
      .includes(status) ? status.toLowerCase() : 'pending';

    pill.className = `pill ${statusClass}`;
    pill.textContent = status;
    tdStatus.append(pill);
    tr.append(tdStatus);

    const tdActions = document.createElement('td');
    tdActions.className = 'actions';

    const actions = [
      ['Edit', 'edit', () => startEdit(m.id)],
      ['Delete', 'delete', () => removeMedicine(m.id)]
    ];

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

    tr.append(tdActions);
    rows.append(tr);
  }
}

// ---------------- API HELPERS ----------------

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);

  const text = await response.text();
  let data = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(text);
      }
      throw new Error('Invalid JSON response from server');
    }
  }

  if (!response.ok) {
    throw new Error(
      data?.error || `Request failed (${response.status})`
    );
  }

  return data;
}

// ---------------- REST API ----------------

async function getMedicines() {
  const data = await apiRequest('/medications');

  if (!Array.isArray(data)) {
    throw new Error('Expected medications array');
  }

  return data;
}

async function addMedicineAPI(name, time, dose) {
  return apiRequest('/medications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, time, dose })
  });
}

async function updateMedicineAPI(id, name, time, dose) {
  return apiRequest(
    `/medications/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, time, dose })
    }
  );
}

async function deleteMedicineAPI(id) {
  return apiRequest(
    `/medications/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
}

async function getReadings() {
  return apiRequest('/readings');
}

async function getBoxStatus() {
  return apiRequest('/status');
}

// ---------------- ADD / EDIT ----------------

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const dose = doseInput.value.trim();
  const time = timeInput.value;

  if (!name || !dose || !time) return;

  try {
    if (MODE === 'api') {
      if (editingId !== null) {
        await updateMedicineAPI(editingId, name, time, dose);
        message('Medicine updated.');
      } else {
        await addMedicineAPI(name, time, dose);
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
          medicine.dose = dose;
          medicine.time = time;
          message('Medicine updated (demo).');
        }
      } else {
        medicines.push({
          id: crypto.randomUUID(),
          name,
          dose,
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

// ---------------- EDIT ----------------

function startEdit(id) {
  const medicine = medicines.find(m => m.id === id);
  if (!medicine) return;

  editingId = id;
  nameInput.value = medicine.name;
  doseInput.value = medicine.dose || '';
  timeInput.value = medicine.time;

  document.getElementById('saveBtn').textContent =
    'Save Changes';

  document.getElementById('cancelBtn')
    .classList.remove('hidden');

  nameInput.focus();
}

// ---------------- DELETE ----------------

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

// ---------------- DEMO CONFIRMATION ----------------

function markTaken(id) {
  if (MODE !== 'demo') return;

  const medicine = medicines.find(m => m.id === id);
  if (!medicine) return;

  medicine.status = 'Taken';
  saveMedicines();
  render();
  message('Dose marked taken (demo only).');
}

// ---------------- AUTO REFRESH ----------------

async function refreshMedicines() {
  if (MODE !== 'api') return;

  try {
    medicines = await getMedicines();
    render();
  } catch (error) {
    message('Error loading medicines: ' + error.message);
  }
}

async function refreshSensorAndStatus() {
  if (MODE !== 'api') return;

  try {
    const readings = await getReadings();
    const status = await getBoxStatus();

    document.getElementById('temperature').textContent =
      readings.temperature + ' °C';

    document.getElementById('humidity').textContent =
      readings.humidity + ' %';

    document.getElementById('environmentStatus').textContent =
      'Live sensor readings';

    document.getElementById('boxStatus').textContent =
      status.box;

    document.getElementById('alarmStatus').textContent =
      'Alarm: ' + (status.alarm ? 'ON' : 'OFF');

  } catch (error) {
    message('Error loading sensor/status: ' + error.message);
  }
}

// ---------------- INITIALIZE ----------------

document.getElementById('cancelBtn')
  .addEventListener('click', resetForm);

document.querySelector('header .status').textContent =
  MODE === 'demo' ? '● Demo Mode' : '● API Mode';

if (MODE === 'api') {
  document.querySelector('.hint').textContent =
    'Medication schedules are stored on the backend.';

  refreshMedicines();
  refreshSensorAndStatus();

  setInterval(refreshMedicines, 5000);
  setInterval(refreshSensorAndStatus, 5000);
}

render();
