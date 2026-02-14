// AddLot View - Screenshot upload and OCR processing

import { extractOrderData, fileToBase64, createThumbnail } from '../services/ocr.js';
import { saveLot } from '../services/storage.js';
import { navigate } from '../router.js';
import { celebrateSuccess } from '../utils/animations.js';
import { importLotsFromCSV, generateCSVTemplate } from '../services/csvImport.js';

let currentState = 'upload'; // 'upload', 'processing', 'preview'
let ocrProgress = 0;
let extractedData = { name: '', cost: 0, quantity: 1 };
let imagePreview = null;
let thumbnailData = null;
let imageZoomed = false;

export function resetAddLotState() {
  currentState = 'upload';
  ocrProgress = 0;
  extractedData = { name: '', cost: 0, quantity: 1 };
  imagePreview = null;
  thumbnailData = null;
  imageZoomed = false;
}

export function AddLotView() {
  if (currentState === 'processing') {
    return renderProcessingState();
  }

  if (currentState === 'preview') {
    return renderPreviewState();
  }

  return renderUploadState();
}

function renderUploadState() {
  return `
    <div class="page">
      <div class="container">
        <div class="upload-area" id="upload-area">
          <div class="upload-icon">📸</div>
          <div class="upload-text">Tap to upload order screenshot</div>
          <div class="upload-hint">Amazon, Target, Walmart, etc.</div>
        </div>
        
        <input type="file" id="file-input" accept="image/*" style="display: none;" />
        
        <div style="text-align: center; margin-top: var(--spacing-xl);">
          <p class="text-muted" style="margin-bottom: var(--spacing-lg);">or</p>
          <button class="btn btn-secondary btn-full" id="manual-entry-btn">
            Enter Manually
          </button>
        </div>

        <div style="text-align: center; margin-top: var(--spacing-xl); margin-bottom: var(--spacing-md);">
          <div style="display: flex; align-items: center; gap: var(--spacing-md); margin-bottom: var(--spacing-xl);">
            <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
            <span class="text-muted" style="font-size: var(--font-size-sm);">BULK IMPORT</span>
            <div style="flex: 1; height: 1px; background: var(--border-color);"></div>
          </div>
        </div>

        <div class="upload-area" id="import-csv-area" style="border-color: rgba(204, 255, 0, 0.15);">
          <div class="upload-icon">📄</div>
          <div class="upload-text">Import from CSV</div>
          <div class="upload-hint">Bulk import lots and sales from a spreadsheet</div>
        </div>
        <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display: none;" />

      </div>
    </div>
  `;
}

function renderProcessingState() {
  return `
    <div class="page">
      <div class="container">
        <div class="card">
          <div class="ocr-progress">
            <div class="progress-spinner"></div>
            <div class="progress-text">Scanning image... ${ocrProgress}%</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPreviewState() {
  const zoomClass = imageZoomed ? 'zoomed' : '';

  return `
    <div class="page">
      <div class="container">
        ${imagePreview ? `
          <div class="image-preview-container ${zoomClass}" id="image-preview-container">
            <img src="${imagePreview}" class="image-preview ${zoomClass}" alt="Order screenshot" id="preview-image" />
            <div class="image-hint">${imageZoomed ? 'Tap to shrink' : 'Tap to zoom'}</div>
          </div>
        ` : ''}
        
        <div class="card">
          <div class="form-group">
            <label class="form-label">Item Name</label>
            <div class="input-with-clear">
              <input type="text" class="form-input" id="lot-name" value="${escapeHtml(extractedData.name)}" placeholder="Enter item name" />
              <button type="button" class="clear-input-btn" id="clear-name-btn" title="Clear">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md); margin-bottom: var(--spacing-md);">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Cost (USD)</label>
              <input type="number" class="form-input" id="lot-cost" value="${extractedData.cost || ''}" placeholder="0.00" step="0.01" min="0" inputmode="decimal" />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Qty</label>
              <div class="quantity-stepper">
                <button type="button" class="stepper-btn" id="decrease-qty">-</button>
                <input type="number" class="form-input stepper-input" id="lot-quantity" value="${extractedData.quantity}" placeholder="1" min="1" inputmode="numeric" readonly />
                <button type="button" class="stepper-btn" id="increase-qty">+</button>
              </div>
            </div>
          </div>
          
          <div class="form-group date-group">
            <label class="form-label">Purchase Date</label>
            <input type="date" class="form-input" id="lot-purchase-date" value="${new Date().toISOString().split('T')[0]}" />
          </div>
          
          <button class="btn btn-primary btn-full" id="save-lot-btn">
            Save to Inventory
          </button>
          
          <button class="btn btn-secondary btn-full" id="cancel-btn" style="margin-top: var(--spacing-md);">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function handleFileUpload(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert('Please select a valid image file');
    return;
  }

  currentState = 'processing';
  ocrProgress = 0;
  window.dispatchEvent(new CustomEvent('viewchange'));

  try {
    const base64 = await fileToBase64(file);
    imagePreview = base64;
    thumbnailData = await createThumbnail(base64, 200);

    const result = await extractOrderData(file, (progress) => {
      ocrProgress = progress;
      window.dispatchEvent(new CustomEvent('viewchange'));
    });

    extractedData = {
      name: result.name || '',
      cost: result.cost || 0,
      quantity: result.quantity || 1
    };

    currentState = 'preview';
    window.dispatchEvent(new CustomEvent('viewchange'));
  } catch (error) {
    console.error('OCR failed:', error);
    alert('Failed to process image. Please try again or enter manually.');
    currentState = 'upload';
    window.dispatchEvent(new CustomEvent('viewchange'));
  }
}

function saveLotAndNavigate() {
  const nameInput = document.getElementById('lot-name');
  const costInput = document.getElementById('lot-cost');
  const qtyInput = document.getElementById('lot-quantity');
  const purchaseDateInput = document.getElementById('lot-purchase-date');

  const name = nameInput?.value.trim() || 'Unnamed Item';
  const cost = parseFloat(costInput?.value) || 0;
  const quantity = parseInt(qtyInput?.value) || 1;
  const purchaseDate = purchaseDateInput?.value || new Date().toISOString().split('T')[0];

  if (cost <= 0) {
    alert('Please enter a valid cost');
    return;
  }

  saveLot({
    name,
    cost,
    quantity,
    purchaseDate,
    imageData: thumbnailData
  });

  // Celebrate successful save
  const saveBtn = document.getElementById('save-lot-btn');
  celebrateSuccess(saveBtn);

  resetAddLotState();

  // Delay navigation to show celebration
  setTimeout(() => {
    navigate('/inventory');
  }, 1000);
}

export function initAddLotEvents() {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const manualBtn = document.getElementById('manual-entry-btn');
  const saveBtn = document.getElementById('save-lot-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const nameInput = document.getElementById('lot-name');
  const clearNameBtn = document.getElementById('clear-name-btn');
  const imageContainer = document.getElementById('image-preview-container');

  // Upload area click
  uploadArea?.addEventListener('click', () => {
    fileInput?.click();
  });

  // Drag and drop
  uploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('active');
  });

  uploadArea?.addEventListener('dragleave', () => {
    uploadArea.classList.remove('active');
  });

  uploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('active');
    const file = e.dataTransfer?.files[0];
    if (file) handleFileUpload(file);
  });

  // File input change
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  });

  // Manual entry
  manualBtn?.addEventListener('click', () => {
    extractedData = { name: '', cost: 0, quantity: 1 };
    imagePreview = null;
    thumbnailData = null;
    currentState = 'preview';
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  // CSV import
  const importArea = document.getElementById('import-csv-area');
  const csvFileInput = document.getElementById('csv-file-input');

  importArea?.addEventListener('click', () => {
    csvFileInput?.click();
  });

  csvFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importLotsFromCSV(file);
      let message = `Imported ${result.success} lot${result.success !== 1 ? 's' : ''}`;
      if (result.salesImported > 0) {
        message += ` and ${result.salesImported} sale${result.salesImported !== 1 ? 's' : ''}`;
      }
      if (result.errors.length > 0) {
        message += `\n\n${result.errors.length} error(s):\n${result.errors.slice(0, 5).join('\n')}`;
      }
      alert(message);

      if (result.success > 0) {
        navigate('/inventory');
        window.dispatchEvent(new CustomEvent('viewchange'));
      }
    } catch (error) {
      console.error('CSV import failed:', error);
      alert('Failed to import CSV: ' + error.message);
    }
    // Reset input so same file can be re-selected
    csvFileInput.value = '';
  });

  // Auto-select item name on load for quick replacement
  if (nameInput && nameInput.value) {
    nameInput.focus();
    nameInput.select();
  }

  // Clear name button
  clearNameBtn?.addEventListener('click', () => {
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
  });

  // Image zoom toggle
  imageContainer?.addEventListener('click', () => {
    imageZoomed = !imageZoomed;
    window.dispatchEvent(new CustomEvent('viewchange'));
    // Re-focus on name after zoom toggle
    setTimeout(() => {
      const newNameInput = document.getElementById('lot-name');
      if (newNameInput && newNameInput.value) {
        newNameInput.focus();
        newNameInput.select();
      }
    }, 100);
  });

  // Save lot
  saveBtn?.addEventListener('click', saveLotAndNavigate);

  // Cancel
  cancelBtn?.addEventListener('click', () => {
    resetAddLotState();
    window.dispatchEvent(new CustomEvent('viewchange'));
  });

  // Quantity stepper buttons
  const decreaseBtn = document.getElementById('decrease-qty');
  const increaseBtn = document.getElementById('increase-qty');
  const qtyInput = document.getElementById('lot-quantity');

  function handleDecrease(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (qtyInput) {
      const currentQty = parseInt(qtyInput.value) || 1;
      if (currentQty > 1) {
        qtyInput.value = currentQty - 1;
      }
    }
  }

  function handleIncrease(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (qtyInput) {
      const currentQty = parseInt(qtyInput.value) || 1;
      qtyInput.value = currentQty + 1;
    }
  }

  if (decreaseBtn) {
    decreaseBtn.addEventListener('click', handleDecrease);
  }
  if (increaseBtn) {
    increaseBtn.addEventListener('click', handleIncrease);
  }
}
