/**
 * 设置页面组件 - 带密码验证
 */
class SettingsComponent {
    constructor() {
        this.settings = {
            apiServer: this.getDefaultAPIServer(),
            apiToken: '',
            douyinCookie: '',
            tiktokCookie: ''
        };
        this.isAuthenticated = false;
        this.accessToken = '';
    }

    /**
     * 获取默认API服务器地址
     */
    getDefaultAPIServer() {
        // 自动检测API地址：如果是通过反向代理访问，使用当前域名；否则使用localhost
        return window.location.protocol === 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
            ? `${window.location.protocol}//${window.location.host}`
            : 'http://127.0.0.1:5555';
    }

    /**
     * 初始化组件
     */
    async init() {
        // 首先检查本地是否有有效的访问令牌
        if (this.checkLocalAccessToken()) {
            this.showSettingsContent();
        } else {
            await this.checkPasswordStatus();
        }
    }

    /**
     * 检查本地访问令牌是否有效
     */
    checkLocalAccessToken() {
        try {
            const tokenData = localStorage.getItem('settings-access-token');
            if (!tokenData) return false;

            const { token, expireTime } = JSON.parse(tokenData);
            const now = new Date();
            const expire = new Date(expireTime);

            if (now < expire) {
                this.isAuthenticated = true;
                this.accessToken = token;
                return true;
            } else {
                // 令牌过期，清除
                localStorage.removeItem('settings-access-token');
                return false;
            }
        } catch (error) {
            localStorage.removeItem('settings-access-token');
            return false;
        }
    }

    /**
     * 保存访问令牌到本地
     */
    saveLocalAccessToken(token, expireTime) {
        try {
            const tokenData = {
                token: token,
                expireTime: expireTime,
                saveTime: new Date().toISOString()
            };
            localStorage.setItem('settings-access-token', JSON.stringify(tokenData));
        } catch (error) {
            console.error('保存访问令牌失败:', error);
        }
    }

    /**
     * 检查密码设置状态
     */
    async checkPasswordStatus() {
        try {
            const result = await api.getPasswordStatus();
            
            if (result.success) {
                if (result.has_password) {
                    this.showPasswordVerification();
                } else {
                    this.showPasswordSetup();
                }
            } else {
                this.showError('检查密码状态失败: ' + result.error);
            }
        } catch (error) {
            this.showError('检查密码状态失败: ' + error.message);
        }
    }

    /**
     * 显示密码验证界面
     */
    showPasswordVerification() {
        const content = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="password-auth-container bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
                    <!-- 顶部装饰 -->
                    <div class="bg-gradient-to-r from-blue-500 to-purple-600 p-6 text-center">
                        <div class="bg-white bg-opacity-20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <i class="fas fa-shield-alt text-2xl text-white"></i>
                        </div>
                        <h2 class="text-xl font-bold text-white mb-2">安全验证</h2>
                        <p class="text-white text-opacity-90 text-sm">请输入访问密码以继续</p>
                    </div>
                    
                    <!-- 表单内容 -->
                    <div class="p-6">
                        <div class="auth-form">
                            <div class="mb-6">
                                <div class="relative">
                                    <input type="password" 
                                           id="access-password" 
                                           placeholder="请输入访问密码" 
                                           class="w-full pl-12 pr-4 py-4 bg-gray-50 border-0 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all">
                                    <i class="fas fa-lock absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                                </div>
                            </div>
                            
                            <div class="space-y-3">
                                <button id="verify-password-btn" 
                                        class="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg">
                                    <i class="fas fa-unlock-alt mr-2"></i>
                                    验证密码
                                </button>
                                
                                <button id="forgot-password-btn" 
                                        class="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-colors">
                                    <i class="fas fa-question-circle mr-2"></i>
                                    忘记密码？
                                </button>
                            </div>
                        </div>
                        
                        <div id="auth-message" class="mt-4 text-center text-sm"></div>
                    </div>
                    
                    <!-- 底部提示 -->
                    <div class="bg-gray-50 px-6 py-4 text-center">
                        <p class="text-xs text-gray-500">
                            <i class="fas fa-info-circle mr-1"></i>
                            此密码用于保护Cookie等敏感配置信息
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        this.renderContent(content);
        this.bindPasswordVerificationEvents();
    }

    /**
     * 显示密码设置界面
     */
    showPasswordSetup() {
        const content = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="password-auth-container bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
                    <!-- 顶部装饰 -->
                    <div class="bg-gradient-to-r from-green-500 to-blue-500 p-6 text-center">
                        <div class="bg-white bg-opacity-20 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                            <i class="fas fa-shield-alt text-2xl text-white"></i>
                        </div>
                        <h2 class="text-xl font-bold text-white mb-2">设置访问密码</h2>
                        <p class="text-white text-opacity-90 text-sm">首次使用，请设置访问密码</p>
                    </div>
                    
                    <!-- 表单内容 -->
                    <div class="p-6">
                        <div class="auth-form">
                            <div class="mb-4">
                                <div class="relative">
                                    <input type="password" 
                                           id="new-password" 
                                           placeholder="请输入新密码（建议8位以上）" 
                                           class="w-full pl-12 pr-4 py-4 bg-gray-50 border-0 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all">
                                    <i class="fas fa-key absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                                </div>
                            </div>
                            
                            <div class="mb-6">
                                <div class="relative">
                                    <input type="password" 
                                           id="confirm-password" 
                                           placeholder="请再次输入密码" 
                                           class="w-full pl-12 pr-4 py-4 bg-gray-50 border-0 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-all">
                                    <i class="fas fa-lock absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                                </div>
                            </div>
                            
                            <div class="space-y-3">
                                <button id="setup-password-btn" 
                                        class="w-full bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg">
                                    <i class="fas fa-shield-alt mr-2"></i>
                                    设置密码
                                </button>
                            </div>
                        </div>
                        
                        <div id="setup-message" class="mt-4 text-center text-sm"></div>
                    </div>
                    
                    <!-- 底部提示 -->
                    <div class="bg-gray-50 px-6 py-4 text-center">
                        <p class="text-xs text-gray-500">
                            <i class="fas fa-info-circle mr-1"></i>
                            请妥善保管密码，遗失后需要重置应用
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        this.renderContent(content);
        this.bindPasswordSetupEvents();
    }

    /**
     * 显示设置页面内容
     */
    showSettingsContent() {
        const content = `
            <div class="settings-content max-w-4xl mx-auto">
                <!-- 页面标题 -->
                <div class="settings-header mb-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-2xl font-bold text-gray-800">系统设置</h2>
                            <p class="text-gray-600 mt-1">配置API服务器、Cookie和其他选项</p>
                        </div>
                        <div class="flex flex-col sm:flex-row gap-2">
                            <div class="flex gap-2">
                                <button id="change-password-btn" 
                                        class="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors">
                                    <i class="fas fa-key mr-2"></i>修改密码
                                </button>
                                <button id="logout-btn" 
                                        class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors">
                                    <i class="fas fa-sign-out-alt mr-2"></i>退出设置
                                </button>
                            </div>
                            <div id="token-status" class="text-sm text-gray-600 flex items-center">
                                <i class="fas fa-clock mr-1"></i>
                                <span id="token-expire-info">检查中...</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- API服务器设置 -->
                <div class="settings-section mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">
                        <i class="fas fa-server mr-2 text-blue-500"></i>API服务器地址
                    </h3>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <input type="text" 
                               id="api-server" 
                               value="${this.settings.apiServer}"
                               placeholder="${this.getDefaultAPIServer()}" 
                               class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2">
                        <p class="text-sm text-gray-600">修改后需要更新页面</p>
                    </div>
                </div>

                <!-- API Token设置 -->
                <div class="settings-section mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">
                        <i class="fas fa-key mr-2 text-purple-500"></i>API Token (可选)
                    </h3>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <form onsubmit="return false;" autocomplete="off">
                            <input type="text" name="username" autocomplete="username" style="display: none;" aria-hidden="true">
                            <input type="password" 
                                   id="api-token" 
                                   value="${this.settings.apiToken}"
                                   placeholder="输入API访问令牌..." 
                                   autocomplete="new-password"
                                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                        </form>
                    </div>
                </div>

                <!-- Cookie设置 -->
                <div class="settings-section mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">
                        <i class="fas fa-cookie-bite mr-2 text-orange-500"></i>抖音全局Cookie
                    </h3>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <textarea id="douyin-cookie" 
                                  rows="3" 
                                  placeholder="输入抖音Cookie..."
                                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none">${this.settings.douyinCookie}</textarea>
                        <p class="text-sm text-gray-600 mt-2">
                            <i class="fas fa-info-circle mr-1"></i>
                            获取方法：打开抖音网页版 → F12开发者工具 → Network → 刷新页面 → 找到请求 → 复制Cookie
                        </p>
                    </div>
                </div>

                <div class="settings-section mb-6">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">
                        <i class="fas fa-cookie-bite mr-2 text-black"></i>TikTok全局Cookie
                    </h3>
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <textarea id="tiktok-cookie" 
                                  rows="3" 
                                  placeholder="输入TikTok Cookie..."
                                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none">${this.settings.tiktokCookie}</textarea>
                        <p class="text-sm text-gray-600 mt-2">
                            <i class="fas fa-info-circle mr-1"></i>
                            获取方法：打开TikTok网页版 → F12开发者工具 → Network → 刷新页面 → 找到请求 → 复制Cookie
                        </p>
                    </div>
                </div>

                <!-- 操作按钮 -->
                <div class="settings-actions flex gap-3">
                    <button id="save-settings" 
                            class="bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-6 rounded-lg transition-colors flex-1">
                        <i class="fas fa-save mr-2"></i>保存设置
                    </button>
                    
                    <button id="test-connection" 
                            class="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg transition-colors flex-1">
                        <i class="fas fa-plug mr-2"></i>测试连接
                    </button>
                </div>

                <!-- API状态显示 -->
                <div id="api-status" class="mt-4 text-center"></div>
            </div>
        `;
        
        this.renderContent(content);
        this.loadSettings();
        this.bindSettingsEvents();
        this.checkApiConnection();
        this.updateTokenStatus();
    }

    /**
     * 渲染内容到页面
     */
    renderContent(content) {
        const container = document.getElementById('main-content');
        if (container) {
            container.innerHTML = content;
        }
    }

    /**
     * 绑定密码验证事件
     */
    bindPasswordVerificationEvents() {
        const verifyBtn = document.getElementById('verify-password-btn');
        const passwordInput = document.getElementById('access-password');
        const forgotBtn = document.getElementById('forgot-password-btn');

        if (verifyBtn && passwordInput) {
            const handleVerify = async () => {
                const password = passwordInput.value.trim();
                if (!password) {
                    this.showMessage('请输入访问密码', 'error');
                    return;
                }
                await this.verifyPassword(password);
            };

            verifyBtn.addEventListener('click', handleVerify);
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleVerify();
            });
        }

        if (forgotBtn) {
            forgotBtn.addEventListener('click', () => {
                alert('密码重置方法：\\n\\n删除服务器上的配置文件：config/access_password.json\\n删除后重新访问设置页面即可重新设置密码。');
            });
        }

        if (passwordInput) passwordInput.focus();
    }

    /**
     * 绑定密码设置事件
     */
    bindPasswordSetupEvents() {
        const setupBtn = document.getElementById('setup-password-btn');
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');

        if (setupBtn && newPasswordInput && confirmPasswordInput) {
            const handleSetup = async () => {
                const newPassword = newPasswordInput.value.trim();
                const confirmPassword = confirmPasswordInput.value.trim();

                if (!newPassword) {
                    this.showMessage('请输入新密码', 'error');
                    return;
                }
                if (newPassword.length < 6) {
                    this.showMessage('密码长度至少6位', 'error');
                    return;
                }
                if (newPassword !== confirmPassword) {
                    this.showMessage('两次输入的密码不一致', 'error');
                    return;
                }
                await this.setupPassword(newPassword);
            };

            setupBtn.addEventListener('click', handleSetup);
            [newPasswordInput, confirmPasswordInput].forEach(input => {
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') handleSetup();
                });
            });
        }

        if (newPasswordInput) newPasswordInput.focus();
    }

    /**
     * 绑定设置页面事件
     */
    bindSettingsEvents() {
        const saveBtn = document.getElementById('save-settings');
        const testBtn = document.getElementById('test-connection');
        const changePasswordBtn = document.getElementById('change-password-btn');
        const logoutBtn = document.getElementById('logout-btn');

        if (saveBtn) saveBtn.addEventListener('click', () => this.saveSettings());
        if (testBtn) testBtn.addEventListener('click', () => this.testConnection());
        if (changePasswordBtn) changePasswordBtn.addEventListener('click', () => this.showChangePassword());
        if (logoutBtn) logoutBtn.addEventListener('click', () => this.logout());

        const apiServerInput = document.getElementById('api-server');
        if (apiServerInput) {
            apiServerInput.addEventListener('change', () => {
                this.settings.apiServer = apiServerInput.value;
                api.updateBaseURL(apiServerInput.value);
            });
        }
    }

    /**
     * 验证密码
     */
    async verifyPassword(password) {
        const verifyBtn = document.getElementById('verify-password-btn');
        if (verifyBtn) {
            verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>验证中...';
            verifyBtn.disabled = true;
        }

        try {
            const result = await api.verifyPassword(password);
            
            if (result.success) {
                this.isAuthenticated = true;
                this.accessToken = result.access_token;
                
                // 保存访问令牌到本地（24小时有效）
                this.saveLocalAccessToken(result.access_token, result.expire_time);
                
                this.showMessage('验证成功，正在加载设置...', 'success');
                setTimeout(() => this.showSettingsContent(), 1000);
            } else {
                this.showMessage(result.error || '密码验证失败', 'error');
            }
        } catch (error) {
            this.showMessage('密码验证失败: ' + error.message, 'error');
        } finally {
            if (verifyBtn) {
                verifyBtn.innerHTML = '<i class="fas fa-unlock mr-2"></i>验证密码';
                verifyBtn.disabled = false;
            }
        }
    }

    /**
     * 设置密码
     */
    async setupPassword(password) {
        const setupBtn = document.getElementById('setup-password-btn');
        if (setupBtn) {
            setupBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>设置中...';
            setupBtn.disabled = true;
        }

        try {
            const result = await api.setPassword(password);
            
            if (result.success) {
                this.showMessage('密码设置成功，正在验证...', 'success');
                // 自动验证新设置的密码
                setTimeout(async () => {
                    await this.verifyPassword(password);
                }, 1000);
            } else {
                this.showMessage(result.error || '密码设置失败', 'error');
            }
        } catch (error) {
            this.showMessage('密码设置失败: ' + error.message, 'error');
        } finally {
            if (setupBtn) {
                setupBtn.innerHTML = '<i class="fas fa-lock mr-2"></i>设置密码';
                setupBtn.disabled = false;
            }
        }
    }

    showChangePassword() {
        const oldPassword = prompt('请输入当前密码:');
        if (!oldPassword) return;
        const newPassword = prompt('请输入新密码:');
        if (!newPassword) return;
        const confirmPassword = prompt('请确认新密码:');
        if (newPassword !== confirmPassword) {
            alert('两次输入的密码不一致');
            return;
        }
        this.changePassword(oldPassword, newPassword);
    }

    async changePassword(oldPassword, newPassword) {
        try {
            const result = await api.setPassword(newPassword, oldPassword);
            alert(result.success ? '密码修改成功！' : '密码修改失败: ' + result.error);
        } catch (error) {
            alert('密码修改失败: ' + error.message);
        }
    }

    logout() {
        this.isAuthenticated = false;
        this.accessToken = '';
        
        // 清除本地访问令牌
        localStorage.removeItem('settings-access-token');
        
        this.checkPasswordStatus();
    }

    showMessage(message, type = 'info') {
        const messageEl = document.getElementById('auth-message') || document.getElementById('setup-message');
        if (messageEl) {
            const colors = { success: 'text-green-600', error: 'text-red-600', info: 'text-blue-600' };
            messageEl.innerHTML = `<p class="${colors[type] || colors.info}">${message}</p>`;
        }
    }

    showError(message) {
        this.renderContent(`
            <div class="error-container text-center py-12">
                <i class="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
                <h2 class="text-2xl font-bold text-gray-800 mb-4">设置页面加载失败</h2>
                <p class="text-gray-600 mb-6">${message}</p>
                <button onclick="window.location.reload()" 
                        class="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg transition-colors">
                    <i class="fas fa-refresh mr-2"></i>重新加载
                </button>
            </div>
        `);
    }

    async loadSettings() {
        try {
            const localSettings = localStorage.getItem('webui-settings');
            if (localSettings) {
                this.settings = { ...this.settings, ...JSON.parse(localSettings) };
            }

            const result = await api.getCookieSettings();
            if (result.success) {
                this.settings.douyinCookie = result.douyin_cookie || '';
                this.settings.tiktokCookie = result.tiktok_cookie || '';
                this.updateSettingsUI();
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    updateSettingsUI() {
        const elements = {
            'api-server': this.settings.apiServer,
            'api-token': this.settings.apiToken,
            'douyin-cookie': this.settings.douyinCookie,
            'tiktok-cookie': this.settings.tiktokCookie
        };

        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });
    }

    async saveSettings() {
        const elements = ['api-server', 'api-token', 'douyin-cookie', 'tiktok-cookie'];
        const [apiServer, apiToken, douyinCookie, tiktokCookie] = elements.map(id => 
            document.getElementById(id)?.value || ''
        );

        this.settings = { apiServer, apiToken, douyinCookie, tiktokCookie };

        try {
            localStorage.setItem('webui-settings', JSON.stringify(this.settings));
            const result = await api.saveCookieSettings(douyinCookie, tiktokCookie);
            this.showApiStatus(result.success ? '设置保存成功！' : '服务器保存失败: ' + result.error, 
                             result.success ? 'success' : 'error');
        } catch (error) {
            this.showApiStatus('保存设置失败: ' + error.message, 'error');
        }
    }

    async testConnection() {
        const testBtn = document.getElementById('test-connection');
        if (testBtn) {
            testBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>测试中...';
            testBtn.disabled = true;
        }

        try {
            const isOnline = await api.checkStatus();
            this.showApiStatus(isOnline ? 'API连接成功！' : 'API连接失败', isOnline ? 'success' : 'error');
        } catch (error) {
            this.showApiStatus('连接测试失败: ' + error.message, 'error');
        } finally {
            if (testBtn) {
                testBtn.innerHTML = '<i class="fas fa-plug mr-2"></i>测试连接';
                testBtn.disabled = false;
            }
        }
    }

    async checkApiConnection() {
        try {
            const isOnline = await api.checkStatus();
            this.showApiStatus(isOnline ? 'API连接正常' : 'API连接失败', isOnline ? 'success' : 'error');
        } catch (error) {
            this.showApiStatus('API连接失败', 'error');
        }
    }

    showApiStatus(message, type = 'info') {
        const statusEl = document.getElementById('api-status');
        if (statusEl) {
            const colors = { success: 'text-green-600', error: 'text-red-600', info: 'text-blue-600' };
            statusEl.innerHTML = `<p class="${colors[type] || colors.info}">${message}</p>`;
        }
    }

    /**
     * 更新访问令牌状态显示
     */
    updateTokenStatus() {
        const tokenInfoEl = document.getElementById('token-expire-info');
        if (!tokenInfoEl) return;

        try {
            const tokenData = localStorage.getItem('settings-access-token');
            if (!tokenData) {
                tokenInfoEl.textContent = '未登录';
                return;
            }

            const { expireTime } = JSON.parse(tokenData);
            const now = new Date();
            const expire = new Date(expireTime);
            const diff = expire.getTime() - now.getTime();

            if (diff <= 0) {
                tokenInfoEl.textContent = '已过期';
                tokenInfoEl.className = 'text-red-600';
            } else {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                
                if (hours > 0) {
                    tokenInfoEl.textContent = `${hours}小时${minutes}分钟后过期`;
                } else {
                    tokenInfoEl.textContent = `${minutes}分钟后过期`;
                }
                
                // 根据剩余时间设置颜色
                if (diff < 60 * 60 * 1000) { // 小于1小时
                    tokenInfoEl.className = 'text-orange-600';
                } else {
                    tokenInfoEl.className = 'text-green-600';
                }
            }
        } catch (error) {
            tokenInfoEl.textContent = '状态异常';
            tokenInfoEl.className = 'text-red-600';
        }
    }
}

// 创建全局设置组件实例
window.SettingsComponent = SettingsComponent;
window.settingsComponent = new SettingsComponent();
