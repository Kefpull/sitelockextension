let isLockActive = false;
let lockedDomain = '';
let allowedTabId = null;
let blockDelay = 2000; // Default 2000 milliseconds
let pendingClosures = new Map(); // Track tabs scheduled for closure

// Load state on startup
chrome.storage.local.get(['siteLockActive', 'siteLockUrl', 'siteLockDelay'], (result) => {
  isLockActive = result.siteLockActive || false;
  lockedDomain = result.siteLockUrl || '';
  blockDelay = result.siteLockDelay || 2000; // Already in milliseconds
  
  if (isLockActive) {
    setupLockListeners();
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'toggleLock') {
    isLockActive = message.active;
    lockedDomain = message.url;
    blockDelay = message.delay || 2000; // Already in milliseconds
    
    if (isLockActive) {
      setupLockListeners();
      // Get current tab to set as allowed
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          allowedTabId = tabs[0].id;
        }
      });
    } else {
      removeLockListeners();
      allowedTabId = null;
      // Clear any pending closures
      pendingClosures.forEach((timeoutId) => clearTimeout(timeoutId));
      pendingClosures.clear();
    }
  }
});

function setupLockListeners() {
  // Block new tab creation
  chrome.tabs.onCreated.addListener(onTabCreated);
  
  // Monitor tab updates (navigation)
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  
  // Handle tab activation
  chrome.tabs.onActivated.addListener(onTabActivated);
}

function removeLockListeners() {
  chrome.tabs.onCreated.removeListener(onTabCreated);
  chrome.tabs.onUpdated.removeListener(onTabUpdated);
  chrome.tabs.onActivated.removeListener(onTabActivated);
}

function onTabCreated(tab) {
  if (!isLockActive) return;
  
  // Don't block browser internal pages or empty tabs
  if (!tab.url || tab.url === 'about:blank' || isAllowedUrl(tab.url)) {
    return;
  }
  
  // Log the blocked URL for debugging
  console.log(`Site Lock: Detected new tab to ${tab.url} - will close in ${blockDelay/1000} seconds`);
  
  // Schedule tab closure after delay
  const timeoutId = setTimeout(() => {
    chrome.tabs.get(tab.id, (closingTab) => {
      if (chrome.runtime.lastError) {
        // Tab was already closed
        return;
      }
      
      if (closingTab && !isAllowedUrl(closingTab.url)) {
        console.log(`Site Lock: Closing tab ${tab.id} (${closingTab.url})`);
        chrome.tabs.remove(tab.id);
        
        // Focus back to the allowed tab if we have one
        if (allowedTabId) {
          chrome.tabs.update(allowedTabId, { active: true });
        }
      }
    });
    
    // Remove from pending closures
    pendingClosures.delete(tab.id);
  }, blockDelay);
  
  // Track the pending closure
  pendingClosures.set(tab.id, timeoutId);
}

function onTabUpdated(tabId, changeInfo, tab) {
  if (!isLockActive || !changeInfo.url) return;
  
  // If this is our allowed tab and it's navigating away from the locked domain
  if (tabId === allowedTabId && !isAllowedUrl(changeInfo.url)) {
    // Redirect back to the locked domain
    const redirectUrl = lockedDomain.startsWith('http') ? lockedDomain : `https://${lockedDomain}`;
    chrome.tabs.update(tabId, { url: redirectUrl });
  }
  
  // If any other tab tries to navigate to a non-allowed URL
  else if (tabId !== allowedTabId && !isAllowedUrl(changeInfo.url)) {
    // Close this tab
    chrome.tabs.remove(tabId);
    
    // Focus the allowed tab
    if (allowedTabId) {
      chrome.tabs.update(allowedTabId, { active: true });
    }
  }
}

function onTabActivated(activeInfo) {
  if (!isLockActive) return;
  
  // If user switches to a different tab, check if it's allowed
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab && tab.url && !isAllowedUrl(tab.url)) {
      // Close the tab and focus back to allowed tab
      chrome.tabs.remove(activeInfo.tabId);
      
      if (allowedTabId) {
        chrome.tabs.update(allowedTabId, { active: true });
      }
    } else if (tab && tab.url && isAllowedUrl(tab.url)) {
      // Update the allowed tab ID to this one
      allowedTabId = activeInfo.tabId;
    }
  });
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
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Allow exact domain match or subdomains
    return hostname === lockedDomain || hostname.endsWith('.' + lockedDomain);
  } catch (e) {
    return false;
  }
}

// Handle extension icon click to show popup
chrome.action.onClicked.addListener(() => {
  // This will open the popup automatically due to the manifest configuration
});