const APP_URL = chrome.runtime.getURL('index.html');

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: APP_URL });
});
