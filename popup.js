console.log('LeetCode popup starting...');

class LeetCodePopup {
    constructor() {
        this.data = null;
        this.isAuthenticated = false;
        this.init();
    }

    async init() {
        this.updateDate();
        this.setupEventListeners();
        await this.checkAuthAndLoadData();
    }

    updateDate() {
        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            const now = new Date();
            dateElement.textContent = now.toLocaleDateString('en-US', {
                weekday: 'long', month: 'short', day: 'numeric'
            });
        }
    }

    setupEventListeners() {
        try {
            const solveBtn = document.getElementById('solve-btn');
            if (solveBtn) {
                solveBtn.addEventListener('click', () => {
                    chrome.tabs.create({ url: 'https://leetcode.com/problemset/all/' });
                    window.close();
                });
            }

            const dashboardBtn = document.getElementById('dashboard-btn');
            if (dashboardBtn) {
                dashboardBtn.addEventListener('click', () => {
                    chrome.tabs.create({ url: 'chrome://newtab/' });
                    window.close();
                });
            }

            const refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', () => {
                    this.refreshData();
                });
            }

            const disconnectBtn = document.getElementById('disconnect-btn');
            if (disconnectBtn) {
                disconnectBtn.addEventListener('click', () => {
                    this.disconnect();
                });
            }

            chrome.runtime.onMessage.addListener((request) => {
                if (request.action === 'authStateChanged') {
                    this.checkAuthAndLoadData();
                }
            });
        } catch (error) {
            console.error('Error setting up event listeners:', error);
        }
    }

    async checkAuthAndLoadData() {
        try {
            const authResponse = await this.sendMessage({ action: 'checkAuth' });

            if (authResponse && authResponse.authenticated) {
                this.isAuthenticated = true;
                await this.loadData();
            } else {
                this.showLoginPrompt();
            }
        } catch (error) {
            this.showLoginPrompt();
        }
    }

    showLoginPrompt() {
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div class="login-prompt">
                    <div class="header">
                        <h1 class="title">LeetCode Tracker</h1>
                    </div>
                    
                    <div style="text-align: center; padding: 20px;">
                        <div style="font-size: 48px; margin-bottom: 20px;">🔐</div>
                        <h2 style="color: #ff8cc8; margin-bottom: 15px;">Authentication Required</h2>
                        <p style="color: rgba(255, 255, 255, 0.8); margin-bottom: 25px; font-size: 14px;">
                            Connect your LeetCode account using a session token
                        </p>
                        
                        <button id="login-btn" class="btn btn-primary" style="width: 100%; margin-bottom: 15px;">
                            🔑 Connect with Session Token
                        </button>
                        
                        <p style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 20px;">
                            Secure access to your LeetCode data<br>
                            <span style="font-size: 11px; opacity: 0.8;">Works with all login methods</span>
                        </p>
                    </div>
                </div>
            `;

            const loginBtn = document.getElementById('login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => {
                    this.initiateLogin();
                });
            }
        }
    }

    async initiateLogin() {
        console.log('🔓 Initiating login...');

        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.textContent = '⏳ Opening authentication...';
            loginBtn.disabled = true;
        }

        try {
            const response = await this.sendMessage({ action: 'login' });

            if (response && response.authenticated) {
                console.log('✅ Login successful!');
                this.isAuthenticated = true;
                await this.checkAuthAndLoadData();
            } else {
                throw new Error(response?.error || 'Authentication failed');
            }
        } catch (error) {
            console.error('❌ Login failed:', error);
            this.showError('Authentication failed. Please check your session token.');

            if (loginBtn) {
                loginBtn.textContent = '🔑 Connect with Session Token';
                loginBtn.disabled = false;
            }
        }
    }

    async loadData() {
        try {
            console.log('📥 Loading popup data...');
            this.showLoadingState();

            const cached = await this.getCachedData();
            if (cached && this.isCacheValid(cached)) {
                console.log('✅ Using cached data');
                this.data = this.processData(cached);
                this.updateUI();
                setTimeout(() => this.fetchFreshData(true), 1000);
                return;
            }

            console.log('🌐 Fetching fresh data...');
            await this.fetchFreshData();

        } catch (error) {
            console.error('❌ Error loading popup data:', error);
            this.showError('Failed to load data');
        }
    }

    async refreshData() {
        try {
            this.showRefreshingState();
            await this.fetchFreshData();
        } catch (error) {
            this.resetRefreshButton();
            this.showError('Failed to refresh data');
        }
    }

    async disconnect() {
        try {
            const response = await this.sendMessage({ action: 'logout' });
            if (response && response.success) {
                this.isAuthenticated = false;
                this.showLoginPrompt();
            }
        } catch (error) {
            this.showError('Failed to disconnect');
        }
    }

    async fetchFreshData(silent = false) {
        try {
            const response = await this.sendMessage({ action: 'fetchData' });

            if (response && response.success) {
                console.log('✅ Fresh data received in popup');
                this.data = this.processData(response.data);
                this.updateUI();
            } else {
                throw new Error(response?.error || 'Failed to fetch data');
            }
        } catch (error) {
            console.error('❌ Data fetch failed:', error);
            if (!silent) {
                this.showDemoData();
                this.showError(error.message);
            }
        }
    }

    sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Runtime error:', chrome.runtime.lastError);
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response);
                }
            });
        });
    }

    getTotalSolved(raw) {
        if (typeof raw?.totalSolved === 'number') return raw.totalSolved;
        if (Array.isArray(raw?.difficulty)) return raw.difficulty.reduce((s, x) => s + (x?.count || 0), 0);
        if (Array.isArray(raw?.progress)) return raw.progress.reduce((s, x) => s + (x?.count || 0), 0);
        return 0;
    }

    processData(rawData) {
        console.log('⚙️ Processing popup data:', rawData);
        const today = new Date().toISOString().split('T')[0];

        return {
            totalSolved: this.getTotalSolved(rawData), // ← here
            totalSolvedSource: rawData.totalSolvedSource || 'unknown',
            todaySolved: rawData.todaySolved || (rawData.contributions?.[today] || 0),
            username: rawData.username || 'User',
            timestamp: Date.now(),
            source: rawData.source || 'unknown',
            languages: rawData.languages || []
        };
    }

    getCachedData() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['leetcodeData'], (result) => {
                resolve(result.leetcodeData);
            });
        });
    }

    isCacheValid(data) {
        if (!data || !data.timestamp) return false;
        const cacheAge = Date.now() - data.timestamp;
        const maxAge = 1000 * 60 * 10; // 10 minutes
        if (cacheAge >= maxAge) return false;
        if (typeof data.totalSolvedSource === 'undefined') return false;
        if (data.totalSolvedSource === 'submitStats' && Array.isArray(data.languages) && data.languages.length > 0) return false;
        return true;
    }

    showDemoData() {
        console.log('🎭 Showing demo data in popup');
        this.data = { totalSolved: 0, todaySolved: 0, username: 'Demo User', source: 'demo' };
        this.updateUI();
    }

    showLoadingState() {
        const elements = ['daily-count', 'total-solved'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) { element.textContent = '...'; element.style.opacity = '0.5'; }
        });
    }

    updateUI() {
        console.log('🎨 Updating popup UI with data:', this.data);
        try {
            if (!this.data) return;

            this.updateBadge(this.data.todaySolved);
            this.updateElement('total-solved', this.data.totalSolved);

            if (this.data.username && this.data.username !== 'Demo User') {
                const title = document.querySelector('.title');
                if (title) title.textContent = `Hi, ${this.data.username}! 👋`;
            }

            ['daily-count', 'total-solved'].forEach(id => {
                const element = document.getElementById(id);
                if (element) element.style.opacity = '1';
            });

            this.resetRefreshButton();
            this.showDataSource();

        } catch (error) {
            console.error('❌ Error updating popup UI:', error);
        }
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    }

    updateBadge(count) {
        const badge = document.getElementById('daily-count');
        if (badge) {
            badge.textContent = count;
            badge.style.animation = 'none';
            badge.offsetHeight;
            badge.style.animation = 'pulse 0.6s ease-in-out';
        }
    }

    showRefreshingState() {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.textContent = '⏳ ...';
            refreshBtn.disabled = true;
            refreshBtn.style.opacity = '0.6';
        }
    }

    resetRefreshButton() {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.textContent = '🔄 Refresh';
            refreshBtn.disabled = false;
            refreshBtn.style.opacity = '1';
        }
    }

    showDataSource() {
        if (this.data?.source === 'api' || this.data?.source === 'graphql') {
            const badge = document.getElementById('daily-count');
            if (badge) badge.style.borderColor = 'rgba(107, 255, 157, 0.5)';
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: absolute; top: 10px; left: 50%;
            transform: translateX(-50%); background: rgba(255, 107, 107, 0.9);
            color: white; padding: 0.5rem 1rem; border-radius: 20px;
            font-size: 11px; backdrop-filter: blur(10px); z-index: 1000;
            animation: fadeInOut 3s ease-in-out; max-width: 280px; text-align: center;
        `;
        errorDiv.textContent = message.length > 50 ? 'Connection failed' : message;
        document.body.appendChild(errorDiv);
        setTimeout(() => { errorDiv.remove(); }, 3000);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes pulse { 0% { transform: scale(1);} 50% { transform: scale(1.05);} 100% { transform: scale(1);} }
    @keyframes fadeInOut { 0% { opacity: 0; transform: translateX(-50%) translateY(-10px);} 20% { opacity: 1; transform: translateX(-50%) translateY(0);}
      80% { opacity: 1; transform: translateX(-50%) translateY(0);} 100% { opacity: 0; transform: translateX(-50%) translateY(-10px);} }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Popup DOM loaded, initializing...');
    try { new LeetCodePopup(); }
    catch (error) {
        console.error('❌ Error initializing popup:', error);
        const container = document.querySelector('.container');
        if (container) {
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: white; flex-direction: column; gap: 15px; text-align: center;">
                    <h2>⚠️ Popup Error</h2>
                    <p style="font-size: 12px;">Error: ${error.message}</p>
                    <button onclick="window.location.reload()" style="background: #ff6b9d; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        🔄 Reload
                    </button>
                </div>
            `;
        }
    }
});
