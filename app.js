// State Management
let state = {
  machines: [],
  orders: [],
  currentTab: 'dashboard',
  filters: {
    machines: { search: '', status: 'all', location: 'all' },
    orders: { search: '', status: 'all', priority: 'all' }
  },
  editingMachineId: null,
  completingOrderId: null,
  qrScanner: null,
  scannerActive: false,
  machineStep: 1,
  orderStep: 1
};

// API Sync
const API_URL = '/api/data';
let lastSyncHash = '';

async function loadDataFromServer() {
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data = await res.json();
      state.machines = data.machines || [];
      state.orders = data.orders || [];
      lastSyncHash = JSON.stringify({ m: state.machines, o: state.orders });
      return true;
    }
  } catch (e) {
    console.warn('Server unavailable, using localStorage fallback');
  }
  // Fallback to localStorage
  const storedMachines = localStorage.getItem('magic_machines');
  const storedOrders = localStorage.getItem('magic_orders');
  state.machines = storedMachines ? JSON.parse(storedMachines) : [...initialMachines];
  state.orders = storedOrders ? JSON.parse(storedOrders) : [...initialOrders];
  return false;
}

async function saveDataToServer() {
  const payload = { machines: state.machines, orders: state.orders };
  const newHash = JSON.stringify(payload);
  
  // Save to localStorage as backup
  localStorage.setItem('magic_machines', JSON.stringify(state.machines));
  localStorage.setItem('magic_orders', JSON.stringify(state.orders));
  
  // Skip if no changes
  if (newHash === lastSyncHash) return;
  
  try {
    await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    lastSyncHash = newHash;
  } catch (e) {
    console.warn('Failed to sync with server');
  }
}

// Auto-refresh: poll server every 5 seconds for changes
function startAutoRefresh() {
  setInterval(async () => {
    try {
      const res = await fetch(API_URL);
      if (res.ok) {
        const data = await res.json();
        const serverHash = JSON.stringify({ m: data.machines, o: data.orders });
        if (serverHash !== lastSyncHash) {
          state.machines = data.machines || [];
          state.orders = data.orders || [];
          lastSyncHash = serverHash;
          renderAll();
          updateRecentActivity();
        }
      }
    } catch (e) { /* ignore */ }
  }, 5000);
}

// Initialize State
async function init() {
  const storedTheme = localStorage.getItem('magic_theme');

  await loadDataFromServer();

  // Set Theme
  if (storedTheme === 'light') {
    document.body.classList.add('light-theme');
    const toggleIcon = document.querySelector('.theme-toggle-btn span');
    if (toggleIcon) toggleIcon.textContent = '☀️ Modo Claro';
  }

  setupEventListeners();
  renderAll();
  updateRecentActivity();
  startAutoRefresh();

  // Check if URL has ?machine= param (QR scan from physical tag)
  const urlParams = new URLSearchParams(window.location.search);
  const scannedMachineId = urlParams.get('machine');
  if (scannedMachineId) {
    setTimeout(() => handleMachineScan(scannedMachineId), 300);
  }
}

function saveToLocalStorage() {
  saveDataToServer();
}

// Event Listeners Setup
function setupEventListeners() {
  // Sidebar Navigation Tabs
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Theme Toggle Button
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }

  // Modals Open Buttons
  const btnNewOrder = document.getElementById('btn-new-order');
  if (btnNewOrder) {
    btnNewOrder.addEventListener('click', () => openOrderModal());
  }

  const btnNewMachine = document.getElementById('btn-new-machine');
  if (btnNewMachine) {
    btnNewMachine.addEventListener('click', () => openMachineModal());
  }

  // Modals Close Buttons
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });

  document.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      closeAllModals();
    });
  });

  // Form Submissions
  const machineForm = document.getElementById('machine-form');
  if (machineForm) {
    machineForm.addEventListener('submit', handleMachineFormSubmit);
  }

  const orderForm = document.getElementById('order-form');
  if (orderForm) {
    orderForm.addEventListener('submit', handleOrderFormSubmit);
  }

  const completeForm = document.getElementById('complete-form');
  if (completeForm) {
    completeForm.addEventListener('submit', handleCompleteFormSubmit);
  }

  // Step Navigation Buttons
  const machineNextBtn = document.getElementById('machine-next-btn');
  if (machineNextBtn) {
    machineNextBtn.addEventListener('click', () => {
      if (validateCurrentStep('machine')) setMachineStep(state.machineStep + 1);
    });
  }
  const machinePrevBtn = document.getElementById('machine-prev-btn');
  if (machinePrevBtn) {
    machinePrevBtn.addEventListener('click', () => setMachineStep(state.machineStep - 1));
  }
  const orderNextBtn = document.getElementById('order-next-btn');
  if (orderNextBtn) {
    orderNextBtn.addEventListener('click', () => {
      if (validateCurrentStep('order')) setOrderStep(state.orderStep + 1);
    });
  }
  const orderPrevBtn = document.getElementById('order-prev-btn');
  if (orderPrevBtn) {
    orderPrevBtn.addEventListener('click', () => setOrderStep(state.orderStep - 1));
  }

  // Search & Filter Events
  const machineSearch = document.getElementById('machine-search');
  if (machineSearch) {
    machineSearch.addEventListener('input', (e) => {
      state.filters.machines.search = e.target.value.toLowerCase();
      renderMachines();
    });
  }

  const machineStatusFilter = document.getElementById('machine-status-filter');
  if (machineStatusFilter) {
    machineStatusFilter.addEventListener('change', (e) => {
      state.filters.machines.status = e.target.value;
      renderMachines();
    });
  }

  const machineLocationFilter = document.getElementById('machine-location-filter');
  if (machineLocationFilter) {
    machineLocationFilter.addEventListener('change', (e) => {
      state.filters.machines.location = e.target.value;
      renderMachines();
    });
  }

  const orderSearch = document.getElementById('order-search');
  if (orderSearch) {
    orderSearch.addEventListener('input', (e) => {
      state.filters.orders.search = e.target.value.toLowerCase();
      renderOrders();
    });
  }

  const orderStatusFilter = document.getElementById('order-status-filter');
  if (orderStatusFilter) {
    orderStatusFilter.addEventListener('change', (e) => {
      state.filters.orders.status = e.target.value;
      renderOrders();
    });
  }

  const orderPriorityFilter = document.getElementById('order-priority-filter');
  if (orderPriorityFilter) {
    orderPriorityFilter.addEventListener('change', (e) => {
      state.filters.orders.priority = e.target.value;
      renderOrders();
    });
  }

  // Scan QR Button
  const btnScanQR = document.getElementById('btn-scan-qr');
  if (btnScanQR) {
    btnScanQR.addEventListener('click', openQRScannerModal);
  }

  // QR View Modal Close Buttons
  const qrModalClose = document.getElementById('qr-modal-close');
  if (qrModalClose) qrModalClose.addEventListener('click', closeQRViewModal);
  const qrModalCloseBtn = document.getElementById('qr-modal-close-btn');
  if (qrModalCloseBtn) qrModalCloseBtn.addEventListener('click', closeQRViewModal);
  const qrDownloadBtn = document.getElementById('qr-download-btn');
  if (qrDownloadBtn) qrDownloadBtn.addEventListener('click', downloadQRCode);
  const qrPrintBtn = document.getElementById('qr-print-btn');
  if (qrPrintBtn) qrPrintBtn.addEventListener('click', printQRCode);

  // Scan Result Modal Close
  const scanResultClose = document.getElementById('scan-result-close');
  if (scanResultClose) scanResultClose.addEventListener('click', closeScanResultModal);

  // Scanner Modal Close Buttons
  const scannerCloseBtn = document.getElementById('scanner-close-btn');
  if (scannerCloseBtn) scannerCloseBtn.addEventListener('click', closeQRScannerModal);
  const scannerCancelBtn = document.getElementById('scanner-cancel-btn');
  if (scannerCancelBtn) scannerCancelBtn.addEventListener('click', closeQRScannerModal);

  // Scanner Manual ID Search
  const scannerManualBtn = document.getElementById('scanner-manual-btn');
  if (scannerManualBtn) {
    scannerManualBtn.addEventListener('click', () => {
      const input = document.getElementById('scanner-manual-input');
      const id = input.value.trim().toUpperCase();
      if (id) {
        closeQRScannerModal();
        handleMachineScan(id);
      } else {
        input.focus();
      }
    });
  }

  const scannerManualInput = document.getElementById('scanner-manual-input');
  if (scannerManualInput) {
    scannerManualInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('scanner-manual-btn').click();
      }
    });
  }

  // Scanner Camera Activate Button
  const scannerCameraBtn = document.getElementById('scanner-camera-btn');
  if (scannerCameraBtn) {
    scannerCameraBtn.addEventListener('click', startCameraScanner);
  }

  // Close overlays on backdrop click
  document.getElementById('qr-view-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('qr-view-overlay')) closeQRViewModal();
  });
  document.getElementById('scan-result-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('scan-result-overlay')) closeScanResultModal();
  });
  document.getElementById('qr-scanner-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('qr-scanner-overlay')) closeQRScannerModal();
  });
}

// Switching Tab Logic
function switchTab(tabId) {
  state.currentTab = tabId;

  // Toggle active tab link state
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Toggle active content panel
  document.querySelectorAll('.tab-panel').forEach(panel => {
    if (panel.id === `${tabId}-tab`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });

  // Subtitle header label
  const headerSubtitle = document.getElementById('header-subtitle');
  if (headerSubtitle) {
    const titles = {
      dashboard: '',
      machines: 'Gestione el inventario de maquinaria, estados y fichas técnicas.',
      orders: 'Órdenes de mantenimiento correctivo y preventivo.'
    };
    headerSubtitle.textContent = titles[tabId] || '';
  }

  renderAll();
}

// Toggle Dark/Light Theme
function toggleTheme() {
  const isLight = document.body.classList.toggle('light-theme');
  localStorage.setItem('magic_theme', isLight ? 'light' : 'dark');
  const toggleIcon = document.querySelector('.theme-toggle-btn span');
  if (toggleIcon) {
    toggleIcon.textContent = isLight ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
  }
}

// Modals Handling
function openModal(modalId) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('active');
  document.getElementById(modalId).style.display = 'block';
}

function closeAllModals() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('active');
  document.querySelectorAll('.modal-content-wrapper').forEach(content => {
    content.style.display = 'none';
  });
  
  // Clean Form States
  state.editingMachineId = null;
  state.completingOrderId = null;
  
  // Reset steps
  setMachineStep(1);
  setOrderStep(1);
}

// Multi-Step Form Navigation
function setMachineStep(step) {
  state.machineStep = step;
  const totalSteps = 3;
  
  // Update step dots
  document.querySelectorAll('#machine-step-indicator .step-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (i + 1 < step) dot.classList.add('completed');
    else if (i + 1 === step) dot.classList.add('active');
  });
  
  // Update step lines
  const lines = document.querySelectorAll('#machine-step-indicator .step-line');
  lines.forEach((line, i) => {
    line.classList.toggle('active', i + 1 < step);
  });
  
  // Show/hide form steps
  for (let i = 1; i <= totalSteps; i++) {
    const stepEl = document.getElementById(`machine-step-${i}`);
    if (stepEl) stepEl.classList.toggle('active', i === step);
  }
  
  // Show/hide buttons
  document.getElementById('machine-prev-btn').style.display = step === 1 ? 'none' : 'inline-flex';
  document.getElementById('machine-next-btn').style.display = step === totalSteps ? 'none' : 'inline-flex';
  document.getElementById('machine-submit-btn').style.display = step === totalSteps ? 'inline-flex' : 'none';
}

function setOrderStep(step) {
  state.orderStep = step;
  const totalSteps = 3;
  
  document.querySelectorAll('#order-step-indicator .step-dot').forEach((dot, i) => {
    dot.classList.remove('active', 'completed');
    if (i + 1 < step) dot.classList.add('completed');
    else if (i + 1 === step) dot.classList.add('active');
  });
  
  const lines = document.querySelectorAll('#order-step-indicator .step-line');
  lines.forEach((line, i) => {
    line.classList.toggle('active', i + 1 < step);
  });
  
  for (let i = 1; i <= totalSteps; i++) {
    const stepEl = document.getElementById(`order-step-${i}`);
    if (stepEl) stepEl.classList.toggle('active', i === step);
  }
  
  document.getElementById('order-prev-btn').style.display = step === 1 ? 'none' : 'inline-flex';
  document.getElementById('order-next-btn').style.display = step === totalSteps ? 'none' : 'inline-flex';
  document.getElementById('order-submit-btn').style.display = step === totalSteps ? 'inline-flex' : 'none';
}

function validateCurrentStep(formPrefix) {
  const step = formPrefix === 'machine' ? state.machineStep : state.orderStep;
  const stepEl = document.getElementById(`${formPrefix}-step-${step}`);
  if (!stepEl) return true;
  
  const requiredFields = stepEl.querySelectorAll('[required]');
  for (const field of requiredFields) {
    if (!field.value.trim()) {
      field.focus();
      field.style.borderColor = 'var(--status-danger)';
      setTimeout(() => field.style.borderColor = '', 2000);
      return false;
    }
  }
  return true;
}

function openMachineModal(machineId = null) {
  const titleEl = document.getElementById('machine-modal-title');
  const form = document.getElementById('machine-form');
  const deleteBtn = document.getElementById('machine-delete-btn');
  form.reset();
  setMachineStep(1);

  if (machineId) {
    state.editingMachineId = machineId;
    titleEl.textContent = 'Editar Ficha de Máquina';
    deleteBtn.style.display = 'inline-flex';
    const m = state.machines.find(x => x.id === machineId);
    if (m) {
      document.getElementById('machine-id-input').value = m.id;
      document.getElementById('machine-name-input').value = m.name;
      document.getElementById('machine-location-input').value = m.location;
      document.getElementById('machine-status-input').value = m.status;
      document.getElementById('machine-last-maint').value = m.lastMaintenance;
    }
  } else {
    state.editingMachineId = null;
    titleEl.textContent = 'Registrar Nueva Máquina';
    deleteBtn.style.display = 'none';
    const nextIdNum = state.machines.length > 0 
      ? Math.max(...state.machines.map(m => parseInt(m.id.substring(1)))) + 1 
      : 1;
    document.getElementById('machine-id-input').value = `M${nextIdNum.toString().padStart(4, '0')}`;
  }
  openModal('machine-modal-content');
}

function openOrderModal(orderId = null) {
  const form = document.getElementById('order-form');
  form.reset();
  setOrderStep(1);

  // Populate Machine Selector
  const machineSelect = document.getElementById('order-machine-select');
  machineSelect.innerHTML = '<option value="" disabled selected>Seleccione una máquina...</option>';
  state.machines.forEach(m => {
    machineSelect.innerHTML += `<option value="${m.id}">${m.name} (${m.location})</option>`;
  });

  openModal('order-modal-content');
}

function openCompleteModal(orderId) {
  state.completingOrderId = orderId;
  const order = state.orders.find(o => o.id === orderId);
  document.getElementById('complete-order-title').textContent = order ? order.title : 'Completar Orden';
  document.getElementById('complete-notes').value = '';
  openModal('complete-modal-content');
}

// Render Functions
function renderAll() {
  if (state.currentTab === 'dashboard') {
    renderDashboard();
  } else if (state.currentTab === 'machines') {
    renderMachines();
  } else if (state.currentTab === 'orders') {
    renderOrders();
  }
}

function renderDashboard() {
  // Compute KPI statistics
  const totalMachines = state.machines.length;
  const inMaint = state.machines.filter(m => m.status === 'mantenimiento').length;
  const inop = state.machines.filter(m => m.status === 'parada').length;
  const pendingOrders = state.orders.filter(o => o.status !== 'completado').length;
  const operative = state.machines.filter(m => m.status === 'operativa').length;

  document.getElementById('kpi-total-machines').textContent = totalMachines;
  document.getElementById('kpi-in-maintenance').textContent = inMaint;
  document.getElementById('kpi-pending-orders').textContent = pendingOrders;
  document.getElementById('kpi-inoperative').textContent = inop;

  // Render Ring Progress
  const pctOperative = totalMachines > 0 ? Math.round((operative / totalMachines) * 100) : 0;
  document.getElementById('pct-operative').textContent = `${pctOperative}%`;
  
  const circle = document.querySelector('.progress-ring-circle');
  if (circle) {
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (pctOperative / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }

  // Ring status counters
  document.getElementById('dash-status-operative').innerHTML = `
    <span class="color-dot ok"></span>
    <span>Operativas: ${operative}</span>
  `;
  document.getElementById('dash-status-maint').innerHTML = `
    <span class="color-dot warning"></span>
    <span>En Mant.: ${inMaint}</span>
  `;
  document.getElementById('dash-status-inop').innerHTML = `
    <span class="color-dot danger"></span>
    <span>Paradas: ${inop}</span>
  `;

  // Render Critical Alerts
  const alertsContainer = document.getElementById('critical-alerts-container');
  alertsContainer.innerHTML = '';

  const stopMachines = state.machines.filter(m => m.status === 'parada');
  const highPriorityOrders = state.orders.filter(o => o.priority === 'alta' && o.status !== 'completado');

  if (stopMachines.length === 0 && highPriorityOrders.length === 0) {
    alertsContainer.innerHTML = `
      <div class="list-item" style="justify-content: center; color: var(--text-muted);">
         ¡Excelente! No hay alertas críticas de maquinaria en este momento.
      </div>
    `;
    return;
  }

  stopMachines.forEach(m => {
    alertsContainer.innerHTML += `
      <div class="list-item" style="border-left: 4px solid var(--status-danger);">
        <div class="item-icon-circle" style="background-color: var(--status-danger-bg); color: var(--status-danger)">
          ⚠️
        </div>
        <div class="item-details">
          <div class="item-title">${m.name} está DETENIDA</div>
          <div class="item-subtext">Ubicación: ${m.location}</div>
        </div>
        <button class="btn btn-secondary" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;" onclick="switchTab('orders'); openOrderModal();">Generar Orden</button>
      </div>
    `;
  });

  highPriorityOrders.forEach(o => {
    const machine = state.machines.find(m => m.id === o.machineId);
    alertsContainer.innerHTML += `
      <div class="list-item" style="border-left: 4px solid var(--status-danger);">
        <div class="item-icon-circle" style="background-color: var(--status-danger-bg); color: var(--status-danger)">
          🔥
        </div>
        <div class="item-details">
          <div class="item-title">Orden Crítica Pendiente: ${o.title}</div>
          <div class="item-subtext">Máquina: ${machine ? machine.name : 'Desconocida'} | Tipo: ${o.type}</div>
        </div>
        <button class="btn btn-primary" style="padding: 0.4rem 0.8rem; font-size: 0.75rem;" onclick="openCompleteModal('${o.id}')">Resolver</button>
      </div>
    `;
  });
}

function renderMachines() {
  const grid = document.getElementById('machines-grid');
  grid.innerHTML = '';

  const { search, status, location } = state.filters.machines;

  const filtered = state.machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(search) || 
                          m.id.toLowerCase().includes(search) ||
                          m.location.toLowerCase().includes(search);
    const matchesStatus = status === 'all' || m.status === status;
    const matchesLocation = location === 'all' || m.location === location;
    return matchesSearch && matchesStatus && matchesLocation;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">
        No se encontraron máquinas con los filtros actuales.
      </div>
    `;
    return;
  }

  filtered.forEach(m => {
    grid.innerHTML += `
      <div class="machine-card" id="machine-card-${m.id}">
        <div class="machine-card-top">
          <span class="machine-status-badge ${m.status}">${m.status}</span>
          <button class="qr-badge-btn" onclick="openQRModal('${m.id}')" title="Ver QR de ${m.name}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg>
            QR
          </button>
        </div>
        <div class="machine-info-content">
          <h3 class="machine-name">${m.name}</h3>
          
          <div class="machine-meta-row" style="margin-top: 0.5rem">
            <span class="machine-meta-lbl">ID:</span>
            <span class="machine-meta-val">${m.id}</span>
          </div>
          <div class="machine-meta-row">
            <span class="machine-meta-lbl">Ubicación:</span>
            <span class="machine-meta-val">${m.location}</span>
          </div>

          <div class="machine-dates">
            <div class="date-row">
              <span class="date-lbl">Último Manto:</span>
              <span class="date-val">${m.lastMaintenance}</span>
            </div>
          </div>
        </div>
        <div class="machine-actions">
          <button class="btn btn-secondary" onclick="openMachineModal('${m.id}')">Editar Ficha</button>
          <button class="btn btn-scan" onclick="openQRModal('${m.id}')" title="Ver QR para imprimir">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/></svg>
            QR
          </button>
          <button class="btn btn-primary" onclick="generateQuickOrder('${m.id}')">Programar Manto</button>
          <button class="btn ${m.status === 'parada' ? 'btn-success' : 'btn-danger'}" onclick="toggleMachineStopped('${m.id}')">${m.status === 'parada' ? 'Reactivar' : 'Marcar Parada'}</button>
        </div>
      </div>
    `;
  });
}

function renderOrders() {
  const container = document.getElementById('orders-container');
  container.innerHTML = '';

  const { search, status, priority } = state.filters.orders;

  const filtered = state.orders.filter(o => {
    const machine = state.machines.find(m => m.id === o.machineId);
    const machineName = machine ? machine.name.toLowerCase() : '';
    
    const matchesSearch = o.title.toLowerCase().includes(search) || 
                          o.description.toLowerCase().includes(search) ||
                          o.id.toLowerCase().includes(search) ||
                          machineName.includes(search);
                          
    const matchesStatus = status === 'all' || o.status === status;
    const matchesPriority = priority === 'all' || o.priority === priority;
    
    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-muted); background: var(--bg-card); border-radius: 20px; border: 1px solid var(--border-color);">
        No se encontraron órdenes de trabajo con los filtros actuales.
      </div>
    `;
    return;
  }

  // Sort orders: pendings and high priority first
  filtered.sort((a, b) => {
    if (a.status === 'completado' && b.status !== 'completado') return 1;
    if (a.status !== 'completado' && b.status === 'completado') return -1;
    const priorityWeights = { alta: 3, media: 2, baja: 1 };
    return priorityWeights[b.priority] - priorityWeights[a.priority];
  });

  filtered.forEach(o => {
    const machine = state.machines.find(m => m.id === o.machineId);
    
    let actionButtonsHTML = '';
    if (o.status === 'pendiente') {
      actionButtonsHTML = `
        <button class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="updateOrderStatus('${o.id}', 'en-progreso')">Iniciar</button>
      `;
    } else if (o.status === 'en-progreso') {
      actionButtonsHTML = `
        <button class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem;" onclick="openCompleteModal('${o.id}')">Resolver</button>
      `;
    } else {
      // Completed, shows details
      actionButtonsHTML = `
        <span style="font-size: 0.8rem; color: var(--status-ok); font-weight:600; display:flex; align-items:center; gap:0.25rem;">✓ Finalizada</span>
      `;
    }

    container.innerHTML += `
      <div class="order-card" id="order-card-${o.id}">
        <div class="order-details-col">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <span class="order-machine-tag">⚙️ ${machine ? machine.name : 'Sin Máquina'}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">ID: ${o.id}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 500;">Creado: ${o.createdAt}</span>
          </div>
          <h4 class="order-title">${o.title}</h4>
          <p class="order-desc">${o.description}</p>
          ${o.notes ? `<p class="order-desc" style="font-style: italic; background: rgba(255,255,255,0.02); padding: 0.5rem; border-radius: 8px; border-left: 2px solid var(--accent)"><strong>Notas técnicas:</strong> ${o.notes}</p>` : ''}
        </div>
        
        <div class="order-badge-row">
          <span class="badge type-${o.type}">${o.type}</span>
        </div>
        
        <div class="order-badge-row">
          <span class="badge priority-${o.priority}">${o.priority}</span>
        </div>

        <div class="order-badge-row" style="display:flex; flex-direction:column; gap:0.5rem; align-items:flex-end;">
          <span class="badge status-${o.status}">${o.status.replace('-', ' ')}</span>
          <div class="order-col-actions">
            ${actionButtonsHTML}
          </div>
        </div>
      </div>
    `;
  });
}

// Logic Actions
function confirmDeleteMachine() {
  if (!state.editingMachineId) return;
  
  const machine = state.machines.find(m => m.id === state.editingMachineId);
  if (!machine) return;
  
  const hasOrders = state.orders.some(o => o.machineId === state.editingMachineId && o.status !== 'completado');
  
  let message = `¿Estás seguro de eliminar la máquina "${machine.name}" (${machine.id})?`;
  if (hasOrders) {
    message += '\n\n⚠️ Esta máquina tiene órdenes de trabajo activas que también serán eliminadas.';
  }
  
  if (confirm(message)) {
    // Remove associated active orders
    state.orders = state.orders.filter(o => o.machineId !== state.editingMachineId && o.status === 'completado');
    
    // Remove machine
    const index = state.machines.findIndex(m => m.id === state.editingMachineId);
    if (index !== -1) {
      const deletedMachine = state.machines.splice(index, 1)[0];
      addActivityLog(`Se eliminó la máquina ${deletedMachine.name} (${deletedMachine.id})`, 'danger');
      saveToLocalStorage();
      closeAllModals();
      renderAll();
    }
  }
}

function toggleMachineStopped(machineId) {
  const idx = state.machines.findIndex(m => m.id === machineId);
  if (idx === -1) return;
  const m = state.machines[idx];
  if (m.status === 'parada') {
    m.status = 'operativa';
    addActivityLog(`Se reactivó la máquina ${m.name} (${m.id})`, 'success');
  } else {
    m.status = 'parada';
    addActivityLog(`Se marcó como parada la máquina ${m.name} (${m.id})`, 'danger');
  }
  saveToLocalStorage();
  renderAll();
  updateRecentActivity();
}

function handleMachineFormSubmit(e) {
  e.preventDefault();
  
  const id = document.getElementById('machine-id-input').value;
  const name = document.getElementById('machine-name-input').value;
  const location = document.getElementById('machine-location-input').value;
  const status = document.getElementById('machine-status-input').value;
  const lastMaintenance = document.getElementById('machine-last-maint').value || new Date().toISOString().split('T')[0];

  if (state.editingMachineId) {
    const index = state.machines.findIndex(m => m.id === state.editingMachineId);
    if (index !== -1) {
      state.machines[index] = {
        ...state.machines[index],
        name, location, status, lastMaintenance
      };
      addActivityLog(`Se editó la ficha de la máquina ${name} (${id})`, 'info');
    }
  } else {
    const imagesList = [
      'images/injection_molder.png',
      'images/cnc_milling.png',
      'images/robotic_arm.png',
      'images/hydraulic_press.png'
    ];
    const selectedImage = imagesList[state.machines.length % imagesList.length];

    const newMachine = {
      id, name, location, status, lastMaintenance,
      image: selectedImage
    };
    state.machines.push(newMachine);
    addActivityLog(`Se registró una nueva máquina: ${name} (${id})`, 'success');
  }

  saveToLocalStorage();
  closeAllModals();
  renderAll();
  updateRecentActivity();
}

function handleOrderFormSubmit(e) {
  e.preventDefault();

  const nextIdNum = state.orders.length > 0 
    ? Math.max(...state.orders.map(o => parseInt(o.id.substring(3)))) + 1 
    : 1001;
  const id = `WO-${nextIdNum}`;

  const machineId = document.getElementById('order-machine-select').value;
  const title = document.getElementById('order-title-input').value;
  const description = document.getElementById('order-desc-input').value;
  const type = document.getElementById('order-type-select').value;
  const priority = document.getElementById('order-priority-select').value;
  const createdAt = new Date().toISOString().split('T')[0];

  const newOrder = {
    id, machineId, title, description, type, priority,
    status: 'pendiente', createdAt, notes: ''
  };

  state.orders.push(newOrder);

  // Update machine status if Corrective (usually indicates machine has problems!)
  if (type === 'corrective') {
    const mIdx = state.machines.findIndex(m => m.id === machineId);
    if (mIdx !== -1 && state.machines[mIdx].status === 'operativa') {
      state.machines[mIdx].status = 'mantenimiento';
    }
  }

  addActivityLog(`Se creó orden de trabajo ${id}: ${title}`, 'info');
  
  saveToLocalStorage();
  closeAllModals();
  renderAll();
  updateRecentActivity();
}

function handleCompleteFormSubmit(e) {
  e.preventDefault();
  
  const notes = document.getElementById('complete-notes').value;
  const orderIdx = state.orders.findIndex(o => o.id === state.completingOrderId);
  
  if (orderIdx !== -1) {
    const o = state.orders[orderIdx];
    o.status = 'completado';
    o.notes = notes;

    // Mark machine back to operative and set maintenance dates
    const mIdx = state.machines.findIndex(m => m.id === o.machineId);
    if (mIdx !== -1) {
      const todayString = new Date().toISOString().split('T')[0];
      state.machines[mIdx].status = 'operativa';
      state.machines[mIdx].lastMaintenance = todayString;
    }

    addActivityLog(`Se completó la orden ${o.id}: ${o.title}`, 'success');
  }

  saveToLocalStorage();
  closeAllModals();
  renderAll();
  updateRecentActivity();
}

function updateOrderStatus(orderId, newStatus) {
  const orderIdx = state.orders.findIndex(o => o.id === orderId);
  if (orderIdx !== -1) {
    const o = state.orders[orderIdx];
    o.status = newStatus;

    // If order starts (en-progreso), update machine status to maintenance
    if (newStatus === 'en-progreso') {
      const mIdx = state.machines.findIndex(m => m.id === o.machineId);
      if (mIdx !== -1) {
        state.machines[mIdx].status = 'mantenimiento';
      }
    }
    
    addActivityLog(`Orden ${orderId} cambió a estado: ${newStatus.replace('-', ' ')}`, 'info');
  }

  saveToLocalStorage();
  renderAll();
  updateRecentActivity();
}

function generateQuickOrder(machineId) {
  switchTab('orders');
  openOrderModal();
  
  // Wait a millisecond for selectors to populate, then set value
  setTimeout(() => {
    document.getElementById('order-machine-select').value = machineId;
  }, 50);
}

// Helpers
function isOverdue(dateStr) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(dateStr);
  return target < today;
}

// Recent Activity Log System (Local Logs in Memory/localStorage)
function addActivityLog(message, type = 'info') {
  const logs = JSON.parse(localStorage.getItem('magic_activity_logs') || '[]');
  const newLog = {
    message,
    type,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString()
  };
  logs.unshift(newLog); // Prepend
  localStorage.setItem('magic_activity_logs', JSON.stringify(logs.slice(0, 15))); // Limit to 15
}

function updateRecentActivity() {
  const logs = JSON.parse(localStorage.getItem('magic_activity_logs') || '[]');
  const container = document.getElementById('recent-activity-container');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.9rem; padding: 1rem;">No hay actividad registrada.</div>`;
    return;
  }

  container.innerHTML = '';
  logs.forEach(l => {
    let emoji = 'ℹ️';
    let iconBg = 'rgba(59, 130, 246, 0.1)';
    let iconColor = 'var(--status-info)';
    
    if (l.type === 'success') {
      emoji = '✅';
      iconBg = 'rgba(16, 185, 129, 0.1)';
      iconColor = 'var(--status-ok)';
    } else if (l.type === 'warning') {
      emoji = '⚠️';
      iconBg = 'rgba(245, 158, 11, 0.1)';
      iconColor = 'var(--status-warning)';
    } else if (l.type === 'danger') {
      emoji = '🗑️';
      iconBg = 'rgba(239, 68, 68, 0.1)';
      iconColor = 'var(--status-danger)';
    }

    container.innerHTML += `
      <div class="list-item">
        <div class="item-icon-circle" style="background-color: ${iconBg}; color: ${iconColor}">
          ${emoji}
        </div>
        <div class="item-details">
          <div class="item-title">${l.message}</div>
          <div class="item-subtext">${l.date}</div>
        </div>
        <div class="item-time">${l.time}</div>
      </div>
    `;
  });
}

// Start Application on Load
window.addEventListener('DOMContentLoaded', init);

// =============================================
// QR FUNCTIONALITY
// =============================================

/**
 * Handles a machine ID obtained from QR scan or URL param.
 * If machine exists -> show scan result panel.
 * If machine doesn't exist -> open registration modal with ID pre-filled.
 */
function handleMachineScan(machineId) {
  const machine = state.machines.find(m => m.id === machineId.toUpperCase());
  if (machine) {
    openScanResultModal(machine.id);
  } else {
    // Machine not found: pre-fill registration modal
    const normalizedId = machineId.toUpperCase();
    const titleEl = document.getElementById('machine-modal-title');
    const form = document.getElementById('machine-form');
    form.reset();
    state.editingMachineId = null;
    titleEl.textContent = `Registrar Máquina — ID: ${normalizedId}`;
    document.getElementById('machine-id-input').value = normalizedId;
    openModal('machine-modal-content');
    // Show a toast-like hint
    showScanToast(`ID "${normalizedId}" no está en el sistema. Completá los datos para registrarla.`, 'warning');
  }
}

/**
 * Opens the QR View modal for a specific machine.
 * Generates the QR code using qrcodejs.
 */
function openQRModal(machineId) {
  const machine = state.machines.find(m => m.id === machineId);
  if (!machine) return;

  // Build URL with param
  const baseUrl = window.location.origin + window.location.pathname;
  const qrUrl = `${baseUrl}?machine=${machine.id}`;

  // Update labels
  document.getElementById('qr-modal-title').textContent = `Código QR — ${machine.name}`;
  document.getElementById('qr-machine-id-badge').textContent = machine.id;
  document.getElementById('qr-machine-name-label').textContent = machine.name;
  document.getElementById('qr-machine-location-label').textContent = machine.location;
  document.getElementById('qr-url-display').textContent = qrUrl;

  // Clear previous QR
  const canvasEl = document.getElementById('qr-code-canvas');
  canvasEl.innerHTML = '';

  // Generate QR
  new QRCode(canvasEl, {
    text: qrUrl,
    width: 200,
    height: 200,
    colorDark: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#ffffff',
    colorLight: 'transparent',
    correctLevel: QRCode.CorrectLevel.H
  });

  // Override colors for better visibility (dark bg theme)
  setTimeout(() => {
    const canvas = canvasEl.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      // Redraw with proper contrast
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const isDark = !document.body.classList.contains('light-theme');
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i+1] + data[i+2]) / 3;
        if (avg < 128) {
          // Dark pixel -> make accent color
          data[i] = isDark ? 255 : 30;
          data[i+1] = isDark ? 255 : 30;
          data[i+2] = isDark ? 255 : 30;
          data[i+3] = 255;
        } else {
          // Light pixel -> transparent
          data[i+3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
  }, 100);

  // Store current QR machine for download
  document.getElementById('qr-download-btn').setAttribute('data-machine-id', machineId);

  // Show overlay
  document.getElementById('qr-view-overlay').classList.add('active');
}

function closeQRViewModal() {
  document.getElementById('qr-view-overlay').classList.remove('active');
}

function downloadQRCode() {
  const canvas = document.querySelector('#qr-code-canvas canvas');
  if (!canvas) return;

  const machineId = document.getElementById('qr-download-btn').getAttribute('data-machine-id');
  const machine = state.machines.find(m => m.id === machineId);

  // Create a download canvas with white/dark background
  const dlCanvas = document.createElement('canvas');
  const padding = 20;
  dlCanvas.width = canvas.width + padding * 2;
  dlCanvas.height = canvas.height + padding * 2;
  const ctx = dlCanvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dlCanvas.width, dlCanvas.height);

  // Draw a clean black QR on white background
  const baseUrl = window.location.origin + window.location.pathname;
  const qrUrl = `${baseUrl}?machine=${machineId}`;

  // Temporarily create a clean QR for download
  const tempDiv = document.createElement('div');
  document.body.appendChild(tempDiv);
  const tempQR = new QRCode(tempDiv, {
    text: qrUrl,
    width: canvas.width,
    height: canvas.height,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(() => {
    const tempCanvas = tempDiv.querySelector('canvas');
    if (tempCanvas) {
      ctx.drawImage(tempCanvas, padding, padding);
      const link = document.createElement('a');
      link.download = `QR-${machineId}-${machine ? machine.name.replace(/\s+/g, '_') : 'maquina'}.png`;
      link.href = dlCanvas.toDataURL('image/png');
      link.click();
    }
    document.body.removeChild(tempDiv);
  }, 150);
}

function printQRCode() {
  const machineId = document.getElementById('qr-download-btn').getAttribute('data-machine-id');
  const machine = state.machines.find(m => m.id === machineId);
  if (!machine) return;

  const baseUrl = window.location.origin + window.location.pathname;
  const qrUrl = `${baseUrl}?machine=${machineId}`;

  // Create a clean QR for print (black on white)
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'fixed';
  tempDiv.style.left = '-9999px';
  document.body.appendChild(tempDiv);

  new QRCode(tempDiv, {
    text: qrUrl,
    width: 250,
    height: 250,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  });

  setTimeout(() => {
    const tempCanvas = tempDiv.querySelector('canvas');
    if (!tempCanvas) { document.body.removeChild(tempDiv); return; }

    const qrDataUrl = tempCanvas.toDataURL('image/png');

    const printWindow = window.open('', '_blank', 'width=400,height=500');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR - ${machine.id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20mm 10mm;
          }
          .label {
            border: 3px solid #000;
            border-radius: 12px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
            width: 70mm;
          }
          .machine-id {
            font-size: 28px;
            font-weight: 900;
            letter-spacing: 2px;
            color: #000;
          }
          .machine-name {
            font-size: 13px;
            font-weight: 600;
            color: #333;
            text-align: center;
          }
          .machine-location {
            font-size: 11px;
            color: #666;
          }
          img {
            width: 180px;
            height: 180px;
          }
          .footer {
            margin-top: 8px;
            font-size: 9px;
            color: #999;
            text-align: center;
          }
          @media print {
            body { padding: 5mm; }
            .label { border-width: 2px; }
          }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="machine-id">${machine.id}</div>
          <div class="machine-name">${machine.name}</div>
          <img src="${qrDataUrl}" alt="QR ${machine.id}">
          <div class="machine-location">${machine.location}</div>
          <div class="footer">Escanear para acceder al panel de mantenimiento</div>
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();

    document.body.removeChild(tempDiv);
  }, 200);
}

/**
 * Opens the scan result panel for an existing machine.
 * Shows machine info + active orders + action buttons.
 */
function openScanResultModal(machineId) {
  const machine = state.machines.find(m => m.id === machineId);
  if (!machine) return;

  const activeOrders = state.orders.filter(o => o.machineId === machineId && o.status !== 'completado');
  const statusColors = {
    operativa: 'var(--status-ok)',
    mantenimiento: 'var(--status-warning)',
    parada: 'var(--status-danger)'
  };
  const statusLabels = {
    operativa: 'Operativa',
    mantenimiento: 'En Mantenimiento',
    parada: 'Fuera de Servicio'
  };

  // Build orders HTML
  let ordersHTML = '';
  if (activeOrders.length === 0) {
    ordersHTML = `<div class="scan-no-orders">✅ Sin órdenes activas pendientes</div>`;
  } else {
    activeOrders.forEach(o => {
      const priorityIcons = { alta: '🔴', media: '🟡', baja: '🟢' };
      let actionBtn = '';
      if (o.status === 'pendiente') {
        actionBtn = `<button class="btn btn-secondary scan-order-btn" onclick="closeScanResultModal(); updateOrderStatus('${o.id}', 'en-progreso')">Iniciar</button>`;
      } else if (o.status === 'en-progreso') {
        actionBtn = `<button class="btn btn-primary scan-order-btn" onclick="closeScanResultModal(); openCompleteModal('${o.id}')">Resolver</button>`;
      }
      ordersHTML += `
        <div class="scan-order-item">
          <div class="scan-order-meta">
            <span class="scan-order-priority">${priorityIcons[o.priority] || '⭐'} ${o.priority}</span>
            <span class="scan-order-status badge status-${o.status}">${o.status.replace('-', ' ')}</span>
          </div>
          <div class="scan-order-title">${o.title}</div>
          ${actionBtn}
        </div>
      `;
    });
  }

  const bodyHTML = `
    <div class="scan-machine-header">
      <div class="scan-machine-status-dot" style="background: ${statusColors[machine.status] || '#888'}"></div>
      <div class="scan-machine-header-info">
        <div class="scan-machine-id">${machine.id}</div>
        <div class="scan-machine-name">${machine.name}</div>
      </div>
      <span class="badge ${machine.status}" style="margin-left:auto">${statusLabels[machine.status] || machine.status}</span>
    </div>

    <div class="scan-machine-details-grid">
      <div class="scan-detail-item">
        <span class="scan-detail-lbl">📍 Ubicación</span>
        <span class="scan-detail-val">${machine.location}</span>
      </div>
      <div class="scan-detail-item">
        <span class="scan-detail-lbl">🔧 Último Manto</span>
        <span class="scan-detail-val">${machine.lastMaintenance || 'N/A'}</span>
      </div>
    </div>

    <div class="scan-orders-section">
      <div class="scan-orders-title">📋 Órdenes Activas (${activeOrders.length})</div>
      ${ordersHTML}
    </div>
  `;

  const footerHTML = `
    <button class="btn btn-secondary" onclick="closeScanResultModal(); openMachineModal('${machineId}')">✏️ Editar Ficha</button>
    <button class="btn btn-primary" onclick="closeScanResultModal(); generateQuickOrder('${machineId}')">➕ Nueva Orden</button>
  `;

  document.getElementById('scan-result-body').innerHTML = bodyHTML;
  document.getElementById('scan-result-footer').innerHTML = footerHTML;
  document.getElementById('scan-result-overlay').classList.add('active');
}

function closeScanResultModal() {
  document.getElementById('scan-result-overlay').classList.remove('active');
}

/**
 * Opens the camera scanner modal using html5-qrcode.
 */
function openQRScannerModal() {
  document.getElementById('qr-scanner-overlay').classList.add('active');
  document.getElementById('scanner-status-msg').textContent = '';

  // Reset sections
  document.getElementById('scanner-camera-content').style.display = 'none';
  document.getElementById('scanner-https-warning').style.display = 'none';
  document.getElementById('scanner-camera-btn').style.display = 'none';
  document.getElementById('scanner-manual-input').value = '';

  // Check if Html5Qrcode is loaded
  if (typeof Html5Qrcode === 'undefined') {
    document.getElementById('scanner-status-msg').textContent = '⚠️ Librería de escaneo no cargada. Verificá conexión a internet.';
    return;
  }

  // Check if camera is available (requires HTTPS or localhost)
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  
  if (!isSecure) {
    // Show HTTPS warning
    document.getElementById('scanner-https-warning').style.display = 'flex';
    document.getElementById('scanner-status-msg').textContent = 'Usá el campo de ID manual arriba para buscar la máquina.';
    return;
  }

  // Camera available — show activate button
  document.getElementById('scanner-camera-btn').style.display = 'inline-flex';
  document.getElementById('scanner-status-msg').textContent = 'Presioná "Activar Cámara" para escanear, o ingresá el ID manualmente.';
}

function startCameraScanner() {
  if (state.scannerActive) return;

  document.getElementById('scanner-camera-btn').style.display = 'none';
  document.getElementById('scanner-camera-content').style.display = 'block';
  document.getElementById('scanner-status-msg').textContent = 'Iniciando cámara...';

  state.qrScanner = new Html5Qrcode('qr-reader');
  state.scannerActive = true;

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0
  };

  state.qrScanner.start(
    { facingMode: 'environment' },
    config,
    (decodedText) => {
      closeQRScannerModal();
      let machineId = decodedText;
      try {
        const url = new URL(decodedText);
        machineId = url.searchParams.get('machine') || decodedText;
      } catch (e) {
        // Not a URL, use raw value
      }
      handleMachineScan(machineId);
    },
    (errorMessage) => {
      // Scanning in progress — ignore frame errors
    }
  ).then(() => {
    document.getElementById('scanner-status-msg').textContent = 'Cámara activa. Apunta al QR...';
  }).catch((err) => {
    document.getElementById('scanner-status-msg').textContent = `⚠️ Error: ${err}. Verificá permisos de cámara.`;
    document.getElementById('scanner-camera-content').style.display = 'none';
    document.getElementById('scanner-camera-btn').style.display = 'inline-flex';
    state.scannerActive = false;
  });
}

function closeQRScannerModal() {
  document.getElementById('qr-scanner-overlay').classList.remove('active');
  if (state.qrScanner && state.scannerActive) {
    state.qrScanner.stop().then(() => {
      state.scannerActive = false;
      state.qrScanner = null;
      // Clear reader div to remove video element
      const readerEl = document.getElementById('qr-reader');
      if (readerEl) readerEl.innerHTML = '';
    }).catch(() => {
      state.scannerActive = false;
      state.qrScanner = null;
    });
  }
}

/**
 * Shows a brief toast notification for scan feedback.
 */
function showScanToast(message, type = 'info') {
  const existing = document.getElementById('scan-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'scan-toast';
  toast.className = `scan-toast scan-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add('scan-toast-visible');
  });

  setTimeout(() => {
    toast.classList.remove('scan-toast-visible');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
