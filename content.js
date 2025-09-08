console.log('🔥 LeetCode Extension: Content script loaded on', window.location.href);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchData') {
    chrome.runtime.sendMessage(request, (response) => sendResponse(response));
    return true;
  }
  if (request.action === 'extractPageData') {
    const pageData = extractLeetCodePageData();
    sendResponse({ success: true, data: pageData });
    return true;
  }
});

function extractLeetCodePageData() {
  const data = { url: window.location.href, title: document.title, isLoggedIn: false, userInfo: null };
  try {
    const userAvatar = document.querySelector('[data-cypress="avatar"]');
    const userMenu = document.querySelector('.nav-user-icon-base');
    if (userAvatar || userMenu) {
      data.isLoggedIn = true;
      const usernameElement = document.querySelector('[data-cypress="navbar-username"]');
      if (usernameElement) data.userInfo = { username: usernameElement.textContent.trim() };
    }
    if (window.location.pathname.includes('/u/')) data.profileStats = extractProfileStats();
  } catch (e) {}
  return data;
}

function extractProfileStats() {
  const stats = {};
  try {
    const problemCounts = document.querySelectorAll('[class*="count"]');
    problemCounts.forEach((el) => {
      const text = el.textContent || '';
      const number = text.match(/\d+/);
      if (number && text.toLowerCase().includes('solved')) stats.totalSolved = parseInt(number[0]);
    });
    const streakElements = document.querySelectorAll('[class*="streak"]');
    streakElements.forEach((el) => {
      const text = el.textContent || '';
      const number = text.match(/\d+/);
      if (number) stats.currentStreak = parseInt(number[0]);
    });
  } catch (e) {}
  return stats;
}

(function tweakPageChromeOnce() {
  if (document.documentElement.dataset.vpTweaked) return;
  document.documentElement.dataset.vpTweaked = '1';

  try {
    document.title = '';
    Array.from(document.querySelectorAll("link[rel*='icon']")).forEach((n) => n.remove());
  } catch (e) {}

  try {
    if (!document.getElementById('vp-footer')) {
      const f = document.createElement('footer');
      f.id = 'vp-footer';
      f.style.cssText = 'position:fixed;left:0;right:0;bottom:0;padding:8px 12px;font:12px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#666;background:#f7f7f7;border-top:1px solid #e5e5e5;text-align:center;z-index:2147483647';
      f.innerHTML = 'made with &lt;3 in pittsburgh · privacy: this tool reads your LeetCode stats with your session and stores them locally. no data leaves your device.';
      document.body.appendChild(f);
      const h = f.getBoundingClientRect().height || 28;
      document.body.style.paddingBottom = (h + 8) + 'px';
    }
  } catch (e) {}
})();
console.log('✅ LeetCode Extension: Content script setup complete');
