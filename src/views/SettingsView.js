// Settings View - Desktop help center

export function SettingsView() {
  return `
    <div class="page settings-page">
      <div class="container">
        <div class="settings-header">
          <h1 class="page-title">Help</h1>
          <p class="settings-subtitle">Quick guidance for using Vision effectively.</p>
        </div>

        <div class="settings-grid">
          <div class="settings-card">
            <h3>Start Here</h3>
            <p>Use this workflow for clean, consistent tracking:</p>
            <ol class="help-steps">
              <li>Add new inventory from the Add tab.</li>
              <li>Record each sale from Inventory or Sales.</li>
              <li>Use Dashboard to monitor profit and trends.</li>
            </ol>
          </div>

          <div class="settings-card">
            <h3>Need Account Help?</h3>
            <p>Open your account panel from the profile icon in the app to manage sign-in and cloud sync.</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function initSettingsEvents() {
  // No interactive controls required for this page currently.
}

