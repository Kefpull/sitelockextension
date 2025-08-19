let isActive = false;
let lockedUrl = '';
let blockDelay = 2000; // Default 2000 milliseconds

// Load saved state
chrome.storage.local.get(['siteLockActive', 'siteLockUrl', 'siteLockDelay'], (result) => {
  isActive = result.siteLockActive || false;
  lockedUrl = result.siteLockUrl || '';
  blockDelay = result.siteLockDelay || 2000;
  
  document.getElementById('urlInput').value = lockedUrl;
  document.getElementById('delayInput').value = blockDelay;
  updateUI();
});

// Get current tab URL and set it
document.getElementById('setCurrentBtn').addEventListener('click', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      const url = new URL(tabs[0].url);
      const domain = url.hostname;
      document.getElementById('urlInput').value = domain;
    }
  });
});

// Toggle lock
document.getElementById('toggleBtn').addEventListener('click', () => {
  const urlInput = document.getElementById('urlInput').value.trim();
  const delayInput = parseInt(document.getElementById('delayInput').value) || 2000;
  
  if (!isActive && !urlInput) {
    alert('Please enter a URL to lock to first!');
    return;
  }
  
  isActive = !isActive;
  
  if (isActive) {
    lockedUrl = urlInput;
    blockDelay = delayInput;
  }
  
  // Save state
  chrome.storage.local.set({
    siteLockActive: isActive,
    siteLockUrl: isActive ? lockedUrl : '',
    siteLockDelay: isActive ? blockDelay : 2000
  });
  
  // Notify background script
  chrome.runtime.sendMessage({
    action: 'toggleLock',
    active: isActive,
    url: lockedUrl,
    delay: blockDelay
  });
  
  updateUI();
});

function updateUI() {
  const status = document.getElementById('status');
  const toggleBtn = document.getElementById('toggleBtn');
  const lockedSite = document.getElementById('lockedSite');
  const lockedUrlSpan = document.getElementById('lockedUrl');
  
  if (isActive) {
    status.textContent = 'ACTIVE - LOCKED';
    status.className = 'status active';
    toggleBtn.textContent = 'DEACTIVATE';
    toggleBtn.className = 'toggle-btn active';
    lockedSite.style.display = 'block';
    lockedUrlSpan.textContent = lockedUrl;
  } else {
    status.textContent = 'INACTIVE';
    status.className = 'status inactive';
    toggleBtn.textContent = 'ACTIVATE LOCK';
    toggleBtn.className = 'toggle-btn';
    lockedSite.style.display = 'none';
  }
}