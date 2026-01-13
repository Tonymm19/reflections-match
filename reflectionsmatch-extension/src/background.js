chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('reflections_sync=true')) {
            chrome.storage.local.set({ ['linkedInSync_' + tabId]: true });
            console.log('LinkedIn Sync flag set for tab', tabId);
        }
    }
});
