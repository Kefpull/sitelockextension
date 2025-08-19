// Content script for additional protection against navigation
let isLockActive = false;
let lockedDomain = '';

// Get current lock state
chrome.storage.local.get(['siteLockActive', 'siteLockUrl'], (result) => {
  isLockActive = result.siteLockActive || false;
  lockedDomain = result.siteLockUrl || '';
  
  if (isLockActive) {
    setupContentProtection();
  }
});

// Listen for lock state changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.siteLockActive) {
      isLockActive = changes.siteLockActive.newValue;
    }
    if (changes.siteLockUrl) {
      lockedDomain = changes.siteLockUrl.newValue;
    }
    
    if (isLockActive) {
      setupContentProtection();
    } else {
      removeContentProtection();
    }
  }
});

function setupContentProtection() {
  // Prevent new windows/tabs from opening via JavaScript
  const originalWindowOpen = window.open;
  window.open = function(...args) {
    if (!isLockActive) {
      return originalWindowOpen.apply(this, args);
    }
    
    const url = args[0];
    if (url && !isAllowedUrl(url)) {
      console.log('Site Lock: Blocked window.open to', url);
      return null;
    }
    
    return originalWindowOpen.apply(this, args);
  };
  
  // Intercept link clicks
  document.addEventListener('click', handleLinkClick, true);
  
  // Intercept form submissions that might navigate away
  document.addEventListener('submit', handleFormSubmit, true);
  
  // Block beforeunload events that might be used to navigate away
  window.addEventListener('beforeunload', handleBeforeUnload, true);
}

function removeContentProtection() {
  document.removeEventListener('click', handleLinkClick, true);
  document.removeEventListener('submit', handleFormSubmit, true);
  window.removeEventListener('beforeunload', handleBeforeUnload, true);
}

function handleLinkClick(event) {
  if (!isLockActive) return;
  
  const link = event.target.closest('a');
  if (!link) return;
  
  const href = link.href;
  if (href && !isAllowedUrl(href)) {
    event.preventDefault();
    event.stopPropagation();
    console.log('Site Lock: Blocked navigation to', href);
    
    // Show a brief notification
    showBlockedNotification();
  }
}

function handleFormSubmit(event) {
  if (!isLockActive) return;
  
  const form = event.target;
  const action = form.action;
  
  if (action && !isAllowedUrl(action)) {
    event.preventDefault();
    event.stopPropagation();
    console.log('Site Lock: Blocked form submission to', action);
    showBlockedNotification();
  }
}

function handleBeforeUnload(event) {
  if (!isLockActive) return;
  
  // Don't actually prevent unload, but log it
  console.log('Site Lock: Page attempting to unload');
}

function isAllowedUrl(url) {
  if (!url || !lockedDomain) return false;
  
  // Always allow browser internal URLs and special pages
  if (url.startsWith('chrome://') || 
      url.startsWith('brave://') || 
      url.startsWith('chrome-extension://') ||
      url.startsWith('moz-extension://') ||
      url.startsWith('edge://') ||
      url === 'about:blank' ||
      url.startsWith('about:') ||
      url.includes('newtab') ||
      url.includes('new-tab-page') ||
      url.startsWith('chrome-search://') ||
      url.startsWith('data:') ||
      url === '') {
    return true;
  }
  
  // Handle relative URLs
  if (url.startsWith('/') || url.startsWith('#') || url.startsWith('?')) {
    return true;
  }
  
  try {
    const urlObj = new URL(url, window.location.href);
    const hostname = urlObj.hostname;
    
    // Allow exact domain match or subdomains
    return hostname === lockedDomain || hostname.endsWith('.' + lockedDomain);
  } catch (e) {
    return false;
  }
}

function showBlockedNotification() {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #dc3545;
    color: white;
    padding: 10px 15px;
    border-radius: 5px;
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  notification.textContent = '🔒 Navigation blocked by Site Lock';
  
  document.body.appendChild(notification);
  
  // Remove after 2 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 2000);
}