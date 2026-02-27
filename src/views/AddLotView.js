// AddLot View - Restructured for Bento UI Picker and Specialized Flows

import { extractOrderData, fileToBase64, createThumbnail } from '../services/ocr.js';
import { saveLot } from '../services/storage.js';
import { navigate } from '../router.js';
import { celebrateSuccess } from '../utils/animations.js';
import { importLotsFromCSV } from '../services/csvImport.js';

// State management for the new Bento UI
let currentActiveView = 'picker'; // 'picker', 'ocr', 'manual', 'csv'
let ocrState = 'idle'; // 'idle', 'parsing', 'reviewed'
let ocrProgress = 0;
let extractedData = { name: '', cost: 0, quantity: 1, platform: '', purchaseDate: new Date().toISOString().split('T')[0] };
let thumbnailData = null;

export function resetAddLotState() {
  currentActiveView = 'picker';
  ocrState = 'idle';
  ocrProgress = 0;
  extractedData = { name: '', cost: 0, quantity: 1, platform: '', purchaseDate: new Date().toISOString().split('T')[0] };
  thumbnailData = null;
}

export function AddLotView() {
  const isDesktop = window.innerWidth >= 1024;

  if (!isDesktop) {
    return `
      <div style="padding: 40px; text-align: center; color: var(--text-secondary);">
        <h2 style="color: var(--text-primary);">Desktop Only View</h2>
        <p>Please use a desktop browser to access the specialized inventory addition tools.</p>
        <button onclick="window.location.hash = '#inventory'" style="margin-top: 20px; background: var(--accent-teal); border: none; padding: 10px 20px; border-radius: 6px; color: black; font-weight: 600; cursor: pointer;">Go Back</button>
      </div>
    `;
  }

  return `
    <div class="add-inventory-view">
      ${renderHeader()}
      ${currentActiveView === 'picker' ? renderPicker() : renderFlow()}
    </div>
  `;
}

function renderHeader() {
  const methodLabels = {
    'picker': '',
    'ocr': 'Order Screenshot',
    'manual': 'Manual Entry',
    'csv': 'CSV Import'
  };

  const isPicker = currentActiveView === 'picker';

  return `
    <div class="add-inventory-header">
      <div class="add-header-content">
        ${!isPicker ? `
          <div class="add-header-breadcrumb">
            <span id="back-to-picker" class="breadcrumb-back">← Back</span>
            <span class="breadcrumb-sep">/</span>
          </div>
        ` : ''}
        <div class="add-header-title">ADD INVENTORY</div>
        ${!isPicker ? `
          <div class="add-header-breadcrumb">
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-current">${methodLabels[currentActiveView]}</span>
          </div>
        ` : ''}
        <div class="add-header-divider"></div>
      </div>
    </div>
  `;
}

function renderPicker() {
  return `
    <div class="add-inventory-picker">
      <!-- 01 Order Screenshot Parser (Featured) -->
      <div class="add-method-card featured" data-view="ocr" style="--index: 0">
        <div class="card-screenshot-collage">
          <img src="/amazon_transparent.png" class="collage-img img-1" alt="Amazon Order">
          <img src="/ebay_transparent.png" class="collage-img img-2" alt="eBay Order">
          <img src="/stockx_transparent.png" class="collage-img img-3" alt="StockX Order">
        </div>
        <div class="add-card-badge">
          <div class="pulse-dot"></div>
          RECOMMENDED
        </div>
        <h2 class="add-card-title">Vision Lens</h2>
        <p class="add-card-desc">Drop in a screenshot of any order confirmation — Amazon, Walmart, Target, Woot, Best Buy. We extract item name, price, quantity, and date automatically.</p>
        <div class="add-card-cta">
          Get started
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </div>
      </div>

      <!-- 02 Add Manually -->
      <div class="add-method-card" data-view="manual" style="--index: 1">
        <div class="add-card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <h2 class="add-card-title">Add Manually</h2>
        <p class="add-card-desc">Fill in the details yourself. Best for single items or when you don't have an order screenshot.</p>
        <div class="add-card-cta">
          Fill form
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </div>
      </div>

      <!-- 03 Import CSV -->
      <div class="add-method-card" data-view="csv" style="--index: 2">
        <div class="add-card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <h2 class="add-card-title">Import CSV</h2>
        <p class="add-card-desc">Bulk import multiple items from a spreadsheet. Download the template to get started.</p>
        <div class="add-card-cta">
          Upload file
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </div>
      </div>
    </div>
  `;
}

function renderFlow() {
  const titles = {
    ocr: 'Vision Lens',
    manual: 'Manual Entry',
    csv: 'CSV Import'
  };

  const subtitles = {
    ocr: 'Upload a confirmation screenshot from Amazon, Walmart, Target, Woot, or Best Buy.',
    manual: 'Enter your inventory details manually for single items.',
    csv: 'Bulk import items from a spreadsheet using our template.'
  };

  return `
    <div class="add-inventory-flow">
      <div class="add-flow-content">
        <h1 class="add-flow-title">${titles[currentActiveView]}</h1>
        <p class="add-flow-subtitle">${subtitles[currentActiveView]}</p>
        
        ${currentActiveView === 'ocr' ? renderOcrFlow() : ''}
        ${currentActiveView === 'manual' ? renderManualFlow() : ''}
        ${currentActiveView === 'csv' ? renderCsvFlow() : ''}
      </div>
      
      <div class="add-flow-sidebar">
        ${renderSidebarContent()}
      </div>
    </div>
  `;
}

function renderOcrFlow() {
  if (ocrState === 'idle' || ocrState === 'parsing') {
    return `
      <div class="add-drop-zone" id="ocr-drop-zone">
        <input type="file" id="ocr-file-input" style="display: none;" accept="image/*" />
        <div class="add-drop-title">Drop your screenshot here</div>
        <div class="add-drop-hint">PNG, JPG, WEBP — works with Amazon, Walmart, Target, Woot, Best Buy, and most order confirmation pages</div>
        
        <button class="btn-secondary-add" style="margin-top: 24px;" id="ocr-browse-btn">Browse file</button>
        
        ${ocrState === 'parsing' ? `
          <div class="add-progress-container">
            <div class="add-progress-bar">
              <div class="add-progress-fill" style="width: ${ocrProgress}%"></div>
            </div>
            <div class="add-progress-text">
              PARSING SCREENSHOT... ${ocrProgress}%
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="teal-notice-bar">
      Fields extracted from screenshot automatically. Please review below.
    </div>
    ${renderInventoryForm(true)}
  `;
}

function renderManualFlow() {
  return renderInventoryForm(false);
}

function renderCsvFlow() {
  return `
    <div class="add-form-group">
      <label class="add-form-label">REQUIRED COLUMNS</label>
      <div class="csv-template-box">
        <div class="csv-template-tags">
          <code class="add-form-code featured">item_name</code>
          <code class="add-form-code featured">purchase_date</code>
          <code class="add-form-code featured">quantity</code>
          <code class="add-form-code featured">total_cost</code>
          <code class="add-form-code">notes</code>
        </div>
        <a href="#" class="csv-template-link">↓ Download template</a>
      </div>
    </div>

    <div class="add-drop-zone" id="csv-drop-zone" style="margin-top: 32px;">
      <input type="file" id="csv-file-input" style="display: none;" accept=".csv" />
      <div class="add-drop-title">Drop your CSV here</div>
      <div class="add-drop-hint">Max 500 rows per import &middot; .csv only</div>
      <button class="btn-secondary-add" style="margin-top: 24px;" id="csv-browse-btn">Browse file</button>
    </div>
    
    <div class="add-form-actions">
      <button class="btn-secondary-add" id="cancel-flow">Cancel</button>
    </div>
  `;
}

function renderInventoryForm(isParsed = false) {
  const costPerUnit = extractedData.quantity > 0 ? (extractedData.cost / extractedData.quantity).toFixed(2) : '0.00';

  return `
    <div class="add-form">
      <div class="add-form-group">
        <label class="add-form-label">ITEM NAME</label>
        <input type="text" class="add-form-input" id="item-name" value="${extractedData.name}" placeholder="e.g. Nike Dunk Low Panda" />
      </div>
      
      <div class="add-form-row">
        <div class="add-form-group">
          <label class="add-form-label">PURCHASE DATE</label>
          <input type="date" class="add-form-input" id="purchase-date" value="${extractedData.purchaseDate}" />
        </div>
      </div>
      
      <div class="add-form-divider"></div>
      
      <div class="add-form-row row-3">
        <div class="add-form-group">
          <label class="add-form-label">QUANTITY</label>
          <div class="quantity-stepper">
            <button type="button" class="stepper-btn" id="add-qty-decrease">-</button>
            <input type="number" 
                   class="add-form-input stepper-input" 
                   id="quantity" 
                   value="${extractedData.quantity}" 
                   min="1" 
                   inputmode="numeric" />
            <button type="button" class="stepper-btn" id="add-qty-increase">+</button>
          </div>
        </div>
        <div class="add-form-group">
          <label class="add-form-label">TOTAL COST</label>
          <div class="input-with-prefix">
            <span class="input-prefix">$</span>
            <input type="number" class="add-form-input has-prefix" id="total-cost" value="${extractedData.cost}" step="0.01" />
          </div>
        </div>
        <div class="add-form-group">
          <label class="add-form-label">COST PER UNIT</label>
          <div class="add-form-input stats-value" id="cost-per-unit-display">
            $${costPerUnit}
          </div>
          <span class="add-form-hint">Auto-calculated</span>
        </div>
      </div>
      
      <div class="add-form-actions" style="display: flex; flex-direction: row; justify-content: flex-start; gap: 16px;">
        <button class="btn btn-primary btn-full record-sale-drawer-btn" id="save-inventory-btn" style="margin: 0; flex: 1; max-width: 220px;">Save to Inventory</button>
        <button class="btn btn-secondary-add" id="cancel-flow" style="margin: 0; flex: 1; max-width: 180px;">${isParsed ? 'Re-upload' : 'Cancel'}</button>
      </div>
    </div>
  `;
}

function renderSidebarContent() {
  if (currentActiveView === 'ocr') {
    return `
      <span class="sidebar-section-title">VISION LENS OCR</span>
      <div class="sidebar-list">
        <div class="sidebar-item">
          <span class="sidebar-item-desc">Drop in a screenshot of any order confirmation from Amazon, Walmart, Target, Woot, or Best Buy.</span>
        </div>
      </div>

      <span class="sidebar-section-title" style="margin-top: 48px;">TIPS</span>
      <div class="sidebar-list">
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Include the full order confirmation page, not just the header</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Make sure the price and quantity are visible in the screenshot</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• You can edit any field after parsing</span>
        </div>
      </div>
    `;
  }

  if (currentActiveView === 'manual') {
    return `
      <span class="sidebar-section-title">HOW IT WORKS</span>
      <div class="sidebar-list">
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Cost per unit is calculated automatically from total cost divided by quantity</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• The item will appear in your inventory immediately after saving</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• You can log sales against this item from the Inventory screen</span>
        </div>
      </div>
    `;
  }

  if (currentActiveView === 'csv') {
    return `
      <span class="sidebar-section-title">BEFORE YOU IMPORT</span>
      <div class="sidebar-list">
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Download the template first to ensure your columns match the required format</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Dates must be formatted as YYYY-MM-DD</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Cost should be a plain number — no $ signs or commas</span>
        </div>
        <div class="sidebar-item">
          <span class="sidebar-item-desc">• Maximum 500 rows per import</span>
        </div>
      </div>
    `;
  }

  return '';
}

// Event handlers
export function initAddLotEvents() {
  const isDesktop = window.innerWidth >= 1024;
  if (!isDesktop) return;

  // Picker navigation
  document.querySelectorAll('.add-method-card').forEach(card => {
    card.addEventListener('click', () => {
      currentActiveView = card.dataset.view;
      window.dispatchEvent(new CustomEvent('viewchange'));
    });
  });

  // Back to picker
  document.getElementById('back-to-picker')?.addEventListener('click', () => {
    resetAddLotState();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  // Flow specific events
  if (currentActiveView === 'ocr') initOcrEvents();
  if (currentActiveView === 'manual') initFormEvents();
  if (currentActiveView === 'csv') initCsvEvents();
}

function initOcrEvents() {
  const dropZone = document.getElementById('ocr-drop-zone');
  const fileInput = document.getElementById('ocr-file-input');
  const browseBtn = document.getElementById('ocr-browse-btn');

  if (ocrState === 'idle' || ocrState === 'parsing') {
    browseBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) handleOcrUpload(file);
    });

    dropZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone?.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer?.files[0];
      if (file) handleOcrUpload(file);
    });
  } else {
    initFormEvents();
  }
}

async function handleOcrUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please select a valid image file');
    return;
  }

  ocrState = 'parsing';
  ocrProgress = 0;
  window.dispatchEvent(new CustomEvent('viewchange'));

  // Simulated parsing delay for better UX (shimmer progress bar)
  // Instead of dispatching viewchange 50 times (causing full layout flashes),
  // we target DOM nodes directly for a perfectly smooth 60fps update progress.
  const interval = setInterval(() => {
    ocrProgress += 5;

    // Direct DOM updates
    const fillEl = document.querySelector('.add-progress-fill');
    const textEl = document.querySelector('.add-progress-text');

    if (fillEl) fillEl.style.width = `${ocrProgress}%`;
    if (textEl) textEl.textContent = `PARSING SCREENSHOT... ${ocrProgress}%`;

    if (ocrProgress >= 100) {
      clearInterval(interval);
      finishParsing(file);
    }
  }, 80);
}

async function finishParsing(file) {
  try {
    const base64 = await fileToBase64(file);
    thumbnailData = await createThumbnail(base64, 200);

    // Call real OCR service
    const result = await extractOrderData(file, (p) => {
      // We already simulated progress for the UI, but we could use the real one
    });

    extractedData = {
      name: result.name || 'Extracted Item Name',
      cost: result.cost || 0,
      quantity: result.quantity || 1,
      platform: result.platform || '',
      purchaseDate: result.purchaseDate || new Date().toISOString().split('T')[0]
    };

    ocrState = 'reviewed';
    window.dispatchEvent(new CustomEvent('viewchange'));
  } catch (error) {
    console.error('OCR failed:', error);
    alert('Failed to parse image. Reverting to manual entry.');
    currentActiveView = 'manual';
    window.dispatchEvent(new CustomEvent('viewchange'));
  }
}

function initFormEvents() {
  const qtyInput = document.getElementById('quantity');
  const costInput = document.getElementById('total-cost');
  const dspl = document.getElementById('cost-per-unit-display');
  const saveBtn = document.getElementById('save-inventory-btn');
  const cancelBtn = document.getElementById('cancel-flow');

  const qtyDec = document.getElementById('add-qty-decrease');
  const qtyInc = document.getElementById('add-qty-increase');

  const updateCalculated = () => {
    const q = parseInt(qtyInput?.value) || 0;
    const c = parseFloat(costInput?.value) || 0;
    const perUnit = q > 0 ? (c / q).toFixed(2) : '0.00';
    if (dspl) dspl.textContent = `$${perUnit}`;
  };

  qtyInput?.addEventListener('input', updateCalculated);
  costInput?.addEventListener('input', updateCalculated);

  qtyDec?.addEventListener('click', () => {
    if (qtyInput) {
      const val = parseInt(qtyInput.value) || 1;
      if (val > 1) {
        qtyInput.value = val - 1;
        updateCalculated();
      }
    }
  });

  qtyInc?.addEventListener('click', () => {
    if (qtyInput) {
      const val = parseInt(qtyInput.value) || 1;
      qtyInput.value = val + 1;
      updateCalculated();
    }
  });

  cancelBtn?.addEventListener('click', () => {
    resetAddLotState();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  saveBtn?.addEventListener('click', () => {
    const name = document.getElementById('item-name').value.trim();
    const cost = parseFloat(document.getElementById('total-cost').value) || 0;
    const quantity = parseInt(document.getElementById('quantity').value) || 1;
    const purchaseDate = document.getElementById('purchase-date').value;

    if (!name || cost <= 0) {
      alert('Please enter a name and valid cost');
      return;
    }

    saveLot({
      name,
      cost,
      quantity,
      purchaseDate,
      imageData: thumbnailData
    });

    setTimeout(() => {
      resetAddLotState();
      navigate('/inventory');
    }, 100);
  });
}

function initCsvEvents() {
  const browseBtn = document.getElementById('csv-browse-btn');
  const fileInput = document.getElementById('csv-file-input');
  const dropZone = document.getElementById('csv-drop-zone');
  const cancelBtn = document.getElementById('cancel-flow');

  browseBtn?.addEventListener('click', () => fileInput?.click());

  cancelBtn?.addEventListener('click', () => {
    resetAddLotState();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleCsvImport(file);
  });

  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) handleCsvImport(file);
  });
}

async function handleCsvImport(file) {
  try {
    const result = await importLotsFromCSV(file);
    alert(`Imported ${result.success} lots successfully.`);
    if (result.success > 0) {
      resetAddLotState();
      navigate('/inventory');
    }
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
}
