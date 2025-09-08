console.log('🚀 LeetCode Dashboard starting...');

class LeetCodeDashboard {
    constructor() {
        this.data = null;
        this.isAuthenticated = false;
        this.init();
    }

    async init() {
        console.log('🔧 Initializing dashboard...');
        this.setupEventListeners();
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
        await this.checkAuthAndLoadData();
        console.log('✅ Dashboard initialized successfully');
    }

    setupEventListeners() {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log('🔄 Manual refresh triggered');
                this.refreshData();
            });
        }

        document.addEventListener('click', (e) => {
            if (e.target.closest('.data-source')) {
                if (confirm('Do you want to disconnect your LeetCode session?')) {
                    this.logout();
                }
            }
        });

        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((request) => {
                if (request.action === 'authStateChanged') {
                    console.log('🔐 Auth state changed:', request);
                    this.checkAuthAndLoadData();
                }
            });
        }
    }

    updateTime() {
        const now = new Date();
        const clock = document.getElementById('clock');
        if (clock) clock.textContent = now.toLocaleTimeString();

        const dateElement = document.getElementById('current-date');
        if (dateElement) {
            dateElement.textContent = new Intl.DateTimeFormat('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            }).format(now);
        }

        const greetingElement = document.getElementById('greeting-text');
        if (greetingElement) {
            const hour = now.getHours();
            let greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
            if (this.data?.username) greeting = `${greeting}!`;
            greetingElement.textContent = greeting;
        }
    }

    async checkAuthAndLoadData() {
        try {
            console.log('🔐 Checking authentication...');
            const authResponse = await this.sendMessage({ action: 'checkAuth' });
            if (authResponse?.authenticated) {
                console.log('✅ User is authenticated');
                this.isAuthenticated = true;
                this.showDashboard();
                await this.loadData();
            } else {
                console.log('❌ User not authenticated');
                this.showLoginPrompt();
            }
        } catch (error) {
            console.error('❌ Auth check failed:', error);
            this.showLoginPrompt();
        }
    }

    showLoginPrompt() {
        const loading = document.getElementById('loading');
        const dashboard = document.getElementById('dashboard');
        if (loading) loading.style.display = 'none';
        if (dashboard) dashboard.style.display = 'none';

        let loginContainer = document.getElementById('login-container');
        if (!loginContainer) {
            loginContainer = document.createElement('div');
            loginContainer.id = 'login-container';
            loginContainer.className = 'container';
            document.body.appendChild(loginContainer);
        }

        loginContainer.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;color:white;">
                <div style="background:rgba(255,255,255,0.1);backdrop-filter:blur(20px);border-radius:20px;padding:3rem;border:1px solid rgba(255,192,203,0.2);max-width:500px;">
                    <div style="font-size:5rem;margin-bottom:2rem;">🔐</div>
                    <h1 style="font-size:2.5rem;margin-bottom:1rem;color:#ff8cc8;background:linear-gradient(135deg,#ff8cc8,#ff6b9d);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Welcome to LeetCode Tracker</h1>
                    <p style="margin-bottom:2rem;opacity:0.9;line-height:1.6;font-size:1.1rem;">
                        Connect your LeetCode account to track your coding progress, daily streaks, and visualize your problem-solving journey.
                    </p>
                    <button id="login-btn" style="background:linear-gradient(135deg,#ff6b9d,#ff8cc8);border:none;padding:1rem 2rem;border-radius:12px;color:white;font-weight:600;cursor:pointer;font-size:1.1rem;transition:all 0.3s ease;box-shadow:0 4px 15px rgba(255,107,157,0.3);margin-bottom:1.5rem;">
                        🔑 Connect with Session Token
                    </button>
                    <p style="color:rgba(255,255,255,0.6);font-size:0.9rem;">
                        Uses your LeetCode session for secure access<br>
                        <span style="font-size:0.8rem;opacity:0.8;">Works with all login methods including SSO</span>
                    </p>
                </div>
            </div>
        `;

        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.initiateLogin());
            loginBtn.addEventListener('mouseenter', () => {
                loginBtn.style.transform = 'translateY(-2px)';
                loginBtn.style.boxShadow = '0 6px 20px rgba(255,107,157,0.4)';
            });
            loginBtn.addEventListener('mouseleave', () => {
                loginBtn.style.transform = 'translateY(0)';
                loginBtn.style.boxShadow = '0 4px 15px rgba(255,107,157,0.3)';
            });
        }
    }

    async initiateLogin() {
        console.log('🔓 Initiating login...');
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.textContent = '⏳ Opening authentication...';
            loginBtn.disabled = true;
            loginBtn.style.opacity = '0.7';
        }

        try {
            const response = await this.sendMessage({ action: 'login' });
            if (response?.authenticated) {
                console.log('✅ Login successful!');
                this.isAuthenticated = true;
                const loginContainer = document.getElementById('login-container');
                if (loginContainer) loginContainer.style.display = 'none';
                await this.checkAuthAndLoadData();
            } else {
                throw new Error(response?.error || 'Authentication failed');
            }
        } catch (error) {
            console.error('❌ Login failed:', error);
            this.showNotification('Authentication failed. Please check your session token and try again.', 'error');
            if (loginBtn) {
                loginBtn.textContent = '🔑 Connect with Session Token';
                loginBtn.disabled = false;
                loginBtn.style.opacity = '1';
            }
        }
    }

    async loadData() {
        try {
            console.log('📥 Loading LeetCode data...');
            const cached = await this.getCachedData();
            if (cached && this.isCacheValid(cached)) {
                console.log('✅ Using cached data');
                this.data = this.processData(cached);
                this.updateUI();
                setTimeout(() => this.fetchFreshData(true), 2000);
                return;
            }
            console.log('🌐 Fetching fresh data...');
            await this.fetchFreshData();
        } catch (error) {
            console.error('❌ Error loading data:', error);
            this.showErrorState(error.message);
        }
    }

    async refreshData() {
        try {
            console.log('🔄 Refreshing data...');
            this.showRefreshingState();
            await this.fetchFreshData();
        } catch (error) {
            console.error('❌ Error refreshing data:', error);
            this.showErrorState('Failed to refresh data. Please try again.');
        }
    }

    async fetchFreshData(silent = false) {
        try {
            const response = await this.sendMessage({ action: 'fetchData' });
            if (response?.success) {
                console.log('✅ Fresh data received');
                this.data = this.processData(response.data);
                this.updateUI();
                if (!silent) this.showNotification('Data refreshed successfully!', 'success');
            } else {
                throw new Error(response?.error || 'Failed to fetch data');
            }
        } catch (error) {
            console.error('❌ Data fetch failed:', error);
            if (!silent) {
                if (error.message.includes('not authenticated')) this.showLoginPrompt();
                else this.showErrorState(error.message);
            }
        }
    }

    sendMessage(message) {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage(message, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Runtime error:', chrome.runtime.lastError);
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response);
                    }
                });
            } else {
                console.log('⚠️ Chrome runtime not available, using demo data');
                if (message.action === 'fetchData') resolve({ success: true, data: this.generateDemoData() });
                else resolve({ success: false, error: 'Chrome runtime not available' });
            }
        });
    }

    getTotalSolved(raw) {
        if (typeof raw?.totalSolved === 'number') return raw.totalSolved;
        if (Array.isArray(raw?.difficulty)) return raw.difficulty.reduce((s, x) => s + (x?.count || 0), 0);
        if (Array.isArray(raw?.progress)) return raw.progress.reduce((s, x) => s + (x?.count || 0), 0);
        return 0;
    }

    processData(rawData) {
        console.log('⚙️ Processing data:', rawData);
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        const monthSolved = rawData.contributions
            ? this.calculateMonthSolved(rawData.contributions)
            : 0;

        const streaks = rawData.contributions
            ? this.calculateStreaks(rawData.contributions)
            : { current: rawData.streak || 0, best: 0 };

        return {
            username: rawData.username || 'User',
            totalSolved: this.getTotalSolved(rawData), // ← here
            totalSolvedSource: rawData.totalSolvedSource || 'unknown',
            languages: rawData.languages || [],
            todaySolved: rawData.todaySolved || (rawData.contributions?.[todayStr] || 0),
            monthSolved,
            contributions: rawData.contributions || {},
            streaks,
            profile: rawData.profile || {},
            difficulty: rawData.difficulty || [],
            timestamp: Date.now(),
            source: rawData.source || 'unknown'
        };
    }

    calculateMonthSolved(contributions) {
        const now = new Date();
        const currentMonth = now.getMonth(), currentYear = now.getFullYear();
        return Object.entries(contributions)
            .reduce((sum, [dateStr, count]) => {
                const d = new Date(dateStr);
                return (d.getMonth() === currentMonth && d.getFullYear() === currentYear)
                    ? sum + count
                    : sum;
            }, 0);
    }

    calculateStreaks(contributions) {
        const dates = Object.keys(contributions).filter(d => contributions[d] > 0).sort();
        if (dates.length === 0) return { current: 0, best: 0 };

        let current = 0;
        for (let i = 0; i < 365; i++) {
            const d = new Date(), check = new Date(d);
            check.setDate(d.getDate() - i);
            if (contributions[check.toISOString().split('T')[0]] > 0) current++;
            else break;
        }

        let best = 1, temp = 1;
        for (let i = 1; i < dates.length; i++) {
            const prev = new Date(dates[i - 1]), curr = new Date(dates[i]);
            const diff = (curr - prev) / (1000 * 60 * 60 * 24);
            if (diff === 1) temp++;
            else { best = Math.max(best, temp); temp = 1; }
        }
        best = Math.max(best, temp);
        return { current, best };
    }

    getCachedData() {
        return new Promise((resolve) => {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.local.get(['leetcodeData'], res => resolve(res.leetcodeData));
            } else resolve(null);
        });
    }

    isCacheValid(data) {
        if (!data?.timestamp) return false;
        const fresh = (Date.now() - data.timestamp) < 1000 * 60 * 15;
        if (!fresh) return false;
        // Force one refresh if older payloads didn’t include the new fields
        if (typeof data.totalSolvedSource === 'undefined') return false;
        // If background marked it as submitStats but languages exist, refetch for the Progress total
        if (data.totalSolvedSource === 'submitStats' && Array.isArray(data.languages) && data.languages.length > 0) return false;
        return true;
    }

    generateDemoData() {
        console.log('🎭 Generating demo data...');
        const contributions = {};
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        for (let d = new Date(yearStart); d <= now; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const rnd = Math.random(), cnt = rnd > 0.93
                ? Math.floor(Math.random() * 5) + 3
                : rnd > 0.85 ? Math.floor(Math.random() * 3) + 2
                    : rnd > 0.7 ? 1
                        : 0;
            if (cnt > 0) contributions[dateStr] = cnt;
        }
        const today = now.toISOString().split('T')[0];
        return {
            username: 'Demo User',
            totalSolved: 247,
            todaySolved: contributions[today] || 2,
            contributions,
            streak: 3,
            timestamp: Date.now(),
            source: 'demo'
        };
    }

    showDashboard() {
        const loading = document.getElementById('loading');
        if (loading) loading.style.display = 'none';
        const dashboard = document.getElementById('dashboard');
        if (dashboard) dashboard.style.display = 'block';
        const loginContainer = document.getElementById('login-container');
        if (loginContainer) loginContainer.style.display = 'none';
    }

    showRefreshingState() {
        const btn = document.getElementById('refresh-btn');
        if (btn) { btn.textContent = '⏳ Refreshing...'; btn.disabled = true; }
    }

    showErrorState(msg) {
        const btn = document.getElementById('refresh-btn');
        if (btn) { btn.textContent = '🔄 Refresh Data'; btn.disabled = false; }
        if (!this.data) { this.data = this.generateDemoData(); this.updateUI(); }
        this.showNotification(`Error: ${msg}`, 'error');
    }

    showNotification(msg, type = 'info') {
        document.querySelector('.notification')?.remove();
        const n = document.createElement('div');
        n.className = 'notification';
        n.style.cssText = `
            position:fixed;top:20px;right:20px;
            background:${type === 'error' ? 'rgba(255,107,107,0.9)' : 'rgba(107,255,157,0.9)'};
            color:#fff;padding:1rem 1.5rem;border-radius:12px;
            backdrop-filter:blur(10px);z-index:1000;font-weight:500;
            max-width:300px;animation:slideIn 0.3s ease;
            box-shadow:0 4px 15px rgba(0,0,0,0.2);
        `;
        n.textContent = msg;
        document.body.appendChild(n);
        setTimeout(() => {
            n.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => n.remove(), 300);
        }, 4000);
    }

    updateUI() {
        console.log('🎨 Updating UI with data:', this.data);
        if (!this.data) return;

        const btn = document.getElementById('refresh-btn');
        if (btn) { btn.textContent = '🔄 Refresh Data'; btn.disabled = false; }

        this.updateTime();
        this.animateNumber('total-solved', this.data.totalSolved);
        this.animateNumber('today-solved', this.data.todaySolved);
        this.animateNumber('month-solved', this.data.streaks.current);

        const streakSubtitle = document.querySelector('#month-solved')?.parentElement?.parentElement?.querySelector('.stat-subtitle');
        if (streakSubtitle) streakSubtitle.textContent = `${this.data.streaks.current} day streak`;

        const yearElem = document.getElementById('heatmap-year');
        if (yearElem) yearElem.textContent = `Recent Contributions`;

        this.generateContributionHeatmap();
        this.showDataSource();
        if (this.data.profile?.avatar) this.showProfileAvatar();
    }

    animateNumber(id, target) {
        const el = document.getElementById(id);
        if (!el) return;
        const current = parseInt(el.textContent) || 0;
        const diff = (target - current) / 20;
        let val = current;
        const interval = setInterval(() => {
            val += diff;
            if ((diff > 0 && val >= target) || (diff < 0 && val <= target)) {
                el.textContent = target;
                clearInterval(interval);
            } else {
                el.textContent = Math.round(val);
            }
        }, 30);
    }

    showProfileAvatar() {
        const h = document.querySelector('.greeting');
        if (h && this.data.profile.avatar && !h.querySelector('.profile-avatar')) {
            const img = document.createElement('img');
            img.className = 'profile-avatar';
            img.src = this.data.profile.avatar;
            img.alt = this.data.username;
            img.style.cssText = 'width:50px;height:50px;border-radius:50%;margin-right:15px;border:3px solid rgba(255,192,203,0.5);';
            h.insertBefore(img, h.firstChild);
            h.style.display = 'flex';
            h.style.alignItems = 'center';
        }
    }

    showDataSource() {
        if (!this.data?.source) return;
        let si = document.querySelector('.data-source');
        if (!si) { si = document.createElement('div'); si.className = 'data-source'; document.body.appendChild(si); }

        si.style.cssText = `
            position:fixed;bottom:20px;left:20px;
            background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);
            padding:0.5rem 1rem;border-radius:20px;font-size:0.8rem;
            backdrop-filter:blur(10px);border:1px solid rgba(255,192,203,0.2);
            display:flex;align-items:center;gap:0.5rem;cursor:pointer;
            transition:all 0.2s ease;
        `;

        const icons = {
            api: ['🔑','Live data via session token'],
            graphql: ['🔗','Live LeetCode data'],
            dom: ['📄','LeetCode page data'],
            demo: ['🎭','Demo data'],
            unknown: ['❓','Unknown source']
        };
        const [icon, text] = icons[this.data.source] || icons.unknown;
        si.innerHTML = `<span>${icon}</span><span>${text}</span>`;

        if (['api','graphql'].includes(this.data.source)) {
            si.innerHTML += `<span style="margin-left:0.5rem;opacity:0.6;font-size:0.7rem;">• Click to disconnect</span>`;
            si.addEventListener('mouseenter', () => {
                si.style.background = 'rgba(255,255,255,0.15)';
                si.style.color = 'rgba(255,255,255,0.9)';
            });
            si.addEventListener('mouseleave', () => {
                si.style.background = 'rgba(255,255,255,0.1)';
                si.style.color = 'rgba(255,255,255,0.7)';
            });
        }
    }

    generateContributionHeatmap() {
        try {
            const grid = document.getElementById('contributions-grid');
            const monthLabels = document.getElementById('month-labels');
            const wrapper = document.querySelector('.grid-wrapper');
            if (!grid || !monthLabels || !wrapper) return;

            grid.innerHTML = '';
            monthLabels.innerHTML = '';

            const today = new Date();
            const start = new Date(today);
            start.setDate(today.getDate() - 364);

            const days = [];
            for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) days.push(new Date(d));

            const firstSunday = new Date(start);
            firstSunday.setDate(firstSunday.getDate() - firstSunday.getDay());

            const monthWeeks = {};
            days.forEach(d => {
                const month = d.toLocaleString('default', { month: 'short' });
                const year = d.getFullYear();
                const key = `${month}-${year}`;
                const weekIndex = Math.floor((d - firstSunday) / (7 * 864e5));
                if (!monthWeeks[key]) monthWeeks[key] = { month, year, weeks: new Set() };
                monthWeeks[key].weeks.add(weekIndex);
            });

            Object.values(monthWeeks).forEach(monthData => {
                const weeks = Array.from(monthData.weeks);
                const minWeek = Math.min(...weeks), maxWeek = Math.max(...weeks);
                const centerWeek = (minWeek + maxWeek) / 2;
                const centerPosition = centerWeek * 16.5 + 25;
                const label = document.createElement('div');
                label.className = 'month-label';
                label.textContent = monthData.month;
                label.style.left = `${centerPosition}px`;
                label.style.transform = 'translateX(-50%)';
                monthLabels.appendChild(label);
            });

            wrapper.querySelector('.week-days')?.remove();
            const wd = document.createElement('div');
            wd.className = 'week-days';
            wd.style.cssText = 'display:grid;grid-template-rows:repeat(7,15px);gap:1.5px;position:absolute;left:0;top:0;';
            ['','Mon','','Wed','','Fri',''].forEach(day => {
                const cell = document.createElement('div');
                cell.style.cssText = 'color:rgba(255,255,255,0.5);font-size:10px;text-align:right;padding-right:8px;';
                cell.textContent = day;
                wd.appendChild(cell);
            });
            wrapper.appendChild(wd);

            document.querySelectorAll('.heatmap-tooltip').forEach(t => t.remove());
            const tooltip = document.createElement('div');
            tooltip.className = 'heatmap-tooltip';
            tooltip.style.cssText = `
              position: absolute;
              background: rgba(0,0,0,0.9);
              color: white;
              padding: 6px;
              border-radius: 6px;
              font-size: 0.8rem;
              opacity: 0;
              transition: opacity .2s;
              z-index: 10000;
            `;
            document.body.appendChild(tooltip);

            let current = new Date(firstSunday);
            let week = 0;
            while (current <= today) {
                for (let dow = 0; dow < 7; dow++) {
                    const dateStr = current.toISOString().split('T')[0];
                    const count = this.data.contributions[dateStr] || 0;
                    const level = count > 6 ? 4 : count >= 4 ? 3 : count >= 2 ? 2 : count > 0 ? 1 : 0;

                    const dayDiv = document.createElement('div');
                    dayDiv.className = `contribution-day level-${level}`;
                    dayDiv.style.gridColumn = week + 1;
                    dayDiv.style.gridRow = dow + 1;

                    if (current >= start && current <= today) {
                        const cp = new Date(current);
                        dayDiv.addEventListener('mouseenter', () => {
                            dayDiv.style.transform = 'scale(1.4)';
                            const formatted = cp.toLocaleDateString('en-US', { month:'short',day:'numeric',year:'numeric' });
                            tooltip.innerHTML = `<strong>${count}</strong> on ${formatted}`;
                            tooltip.style.opacity = '1';
                            const rect = dayDiv.getBoundingClientRect();
                            tooltip.style.left = `${rect.left}px`;
                            tooltip.style.top = `${rect.top - tooltip.offsetHeight - 5}px`;
                        });
                        dayDiv.addEventListener('mouseleave', () => {
                            dayDiv.style.transform = '';
                            tooltip.style.opacity = '0';
                        });
                    } else {
                        dayDiv.style.opacity = '0';
                    }

                    grid.appendChild(dayDiv);
                    current.setDate(current.getDate() + 1);
                }
                week++;
            }

            grid.style.gridTemplateColumns = `repeat(${week}, 15px)`;
        } catch (err) {
            console.error('❌ Error generating heatmap:', err);
        }
    }

    async logout() {
        try {
            console.log('🔓 Logging out...');
            const res = await this.sendMessage({ action: 'logout' });
            if (res?.success) {
                console.log('✅ Logged out successfully');
                this.isAuthenticated = false;
                this.data = null;
                this.showLoginPrompt();
                this.showNotification('Disconnected from LeetCode', 'info');
            }
        } catch (error) {
            console.error('❌ Logout error:', error);
            this.showNotification('Failed to disconnect', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded, initializing...');
    try { new LeetCodeDashboard(); }
    catch (error) {
        console.error('❌ Error initializing dashboard:', error);
        const root = document.getElementById('root') || document.body;
        root.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#667eea,#764ba2);color:white;flex-direction:column;gap:20px;padding:20px;text-align:center;">
                <h1>⚠️ Dashboard Error</h1>
                <p>There was an error loading the dashboard.</p>
                <p>Error: ${error.message}</p>
                <button onclick="window.location.reload()" style="background:#ff6b9d;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">
                    🔄 Reload
                </button>
            </div>
        `;
    }
});

const style = document.createElement('style');
style.textContent = `
@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
@keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
.contribution-day, .stat-card { transition: all 0.2s ease; }
`;
document.head.appendChild(style);
