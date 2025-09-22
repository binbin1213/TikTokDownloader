/**
 * 单页应用路由管理器
 */
class Router {
    constructor() {
        this.routes = {};
        this.currentRoute = null;
        this.components = {};
        
        // 绑定浏览器后退/前进事件
        window.addEventListener('popstate', () => {
            this.handleRoute(window.location.hash);
        });
        
        // 初始化路由
        this.init();
    }

    /**
     * 注册路由
     */
    register(path, component) {
        this.routes[path] = component;
    }

    /**
     * 导航到指定路由
     */
    navigate(path) {
        window.location.hash = path;
        this.handleRoute(path);
    }

    /**
     * 处理路由变化
     */
    async handleRoute(hash) {
        const path = hash.replace('#', '') || 'download';
        
        if (this.currentRoute === path) return;
        
        // 更新导航状态
        this.updateNavigation(path);
        
        // 加载组件
        await this.loadComponent(path);
        
        this.currentRoute = path;
    }

    /**
     * 更新导航高亮
     */
    updateNavigation(activePath) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeNav = document.querySelector(`[data-route="${activePath}"]`);
        if (activeNav) {
            activeNav.classList.add('active');
        }
    }

    /**
     * 加载组件
     */
    async loadComponent(path) {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        // 显示加载状态
        mainContent.innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>加载中...</p>
            </div>
        `;

        try {
            // 如果组件已缓存，直接使用
            if (this.components[path]) {
                mainContent.innerHTML = this.components[path];
                this.initializeComponent(path);
                return;
            }

            // 直接使用内联HTML模板，不加载外部文件
            const html = this.getComponentHTML(path);
            this.components[path] = html; // 缓存组件
            mainContent.innerHTML = html;

            // 初始化组件 - 使用nextTick确保DOM已渲染
            setTimeout(() => {
                this.initializeComponent(path);
            }, 0);

        } catch (error) {
            console.error('加载组件失败:', error);
            mainContent.innerHTML = `
                <div class="error-container">
                    <h2>加载失败</h2>
                    <p>无法加载页面内容，请刷新重试</p>
                    <button onclick="location.reload()" class="btn btn-primary">刷新页面</button>
                </div>
            `;
        }
    }

    /**
     * 获取默认内容（当独立页面不存在时）
     */
    getComponentHTML(path) {
        const contentMap = {
            download: this.getDownloadContent(),
            account: this.getAccountContent(),
            live: this.getLiveContent(),
            search: this.getSearchContent(),
            fileManager: this.getFileManagerContent(),
            settings: this.getSettingsContent()
        };

        return contentMap[path] || '<div class="empty-state"><h2>页面不存在</h2></div>';
    }

    /**
     * 初始化组件
     */
    initializeComponent(path) {
        // 根据路由初始化对应的组件功能
        switch (path) {
            case 'download':
                if (window.downloadComponent) {
                    window.downloadComponent.init();
                }
                break;
            case 'account':
                if (window.accountComponent) {
                    window.accountComponent.init();
                }
                break;
            case 'live':
                if (window.liveComponent) {
                    window.liveComponent.init();
                }
                break;
            case 'search':
                if (window.searchComponent) {
                    window.searchComponent.init();
                }
                break;
            case 'fileManager':
                if (window.fileManagerComponent) {
                    window.fileManagerComponent.init();
                }
                break;
            case 'settings':
                if (window.settingsComponent) {
                    window.settingsComponent.init();
                }
                break;
        }
    }

    /**
     * 初始化路由
     */
    init() {
        // 注册所有路由
        this.register('download', 'download');
        this.register('account', 'account');
        this.register('live', 'live');
        this.register('search', 'search');
        this.register('fileManager', 'fileManager');
        this.register('settings', 'settings');

        // 处理当前路由
        const currentHash = window.location.hash;
        this.handleRoute(currentHash || '#download');
    }

    // ==================== 默认内容模板 ====================

    getDownloadContent() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-download mr-4"></i>单个作品下载
                    </h2>
                    <p class="card-subtitle">输入作品链接或ID下载单个视频/图片</p>
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">作品链接或ID</label>
                    <input type="text" id="work-url" class="form-input" placeholder="粘贴抖音或TikTok作品链接...">
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">Cookie (可选)</label>
                    <input type="text" id="work-cookie" class="form-input" placeholder="输入Cookie以获取更多信息...">
                </div>
                
                <div class="flex gap-4">
                    <button id="get-work-info" class="btn btn-primary">获取作品信息</button>
                    <button id="download-work" class="btn btn-success" disabled>下载作品</button>
                </div>
                
                <div id="work-result" class="hidden mt-6"></div>
            </div>
        `;
    }

    getAccountContent() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-user mr-4"></i>账号作品下载
                    </h2>
                    <p class="card-subtitle">下载指定用户的所有作品</p>
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">用户链接或ID</label>
                    <input type="text" id="account-url" class="form-input" placeholder="输入用户主页链接或sec_uid...">
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">Cookie (必需)</label>
                    <input type="text" id="account-cookie" class="form-input" placeholder="输入Cookie以访问用户作品...">
                </div>
                
                <div class="flex gap-4">
                    <button id="get-account-info" class="btn btn-primary">获取账号信息</button>
                    <button id="download-account" class="btn btn-success" disabled>批量下载</button>
                </div>
                
                <div id="account-result" class="hidden mt-6"></div>
            </div>
        `;
    }

    getLiveContent() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-broadcast-tower mr-4"></i>直播下载
                    </h2>
                    <p class="card-subtitle">获取直播流信息并录制</p>
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">直播间链接或ID</label>
                    <input type="text" id="live-url" class="form-input" placeholder="输入直播间链接或ID...">
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">Cookie (推荐)</label>
                    <input type="text" id="live-cookie" class="form-input" placeholder="输入Cookie以获取更好的直播质量...">
                </div>
                
                <div class="flex gap-4">
                    <button id="get-live-info" class="btn btn-primary">获取直播信息</button>
                </div>
                
                <div id="live-result" class="hidden mt-6"></div>
            </div>
        `;
    }

    getSearchContent() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-search mr-4"></i>搜索功能
                    </h2>
                    <p class="card-subtitle">搜索并下载相关作品</p>
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">搜索关键词</label>
                    <input type="text" id="search-keyword" class="form-input" placeholder="输入要搜索的关键词...">
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">Cookie (推荐)</label>
                    <input type="text" id="search-cookie" class="form-input" placeholder="输入Cookie以获取更多搜索结果...">
                </div>
                
                <div class="flex gap-4">
                    <button id="start-search" class="btn btn-primary">开始搜索</button>
                </div>
                
                <div id="search-result" class="hidden mt-6"></div>
            </div>
        `;
    }

    getFileManagerContent() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-folder-open mr-4"></i>文件管理中心
                    </h2>
                    <p class="card-subtitle">管理您的下载文件、录制任务和存储空间</p>
                </div>

                <!-- 统计仪表板 -->
                <div class="stats-grid mb-6" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                    <div class="stat-card" style="--from-color: #3b82f6; --to-color: #1d4ed8;">
                        <div class="stat-card-content">
                            <div class="stat-value" id="total-downloads">0</div>
                            <div class="stat-label">总下载数</div>
                            <div class="stat-footer">
                                <i class="fas fa-arrow-up mr-2"></i>
                                <span>历史累计</span>
                            </div>
                        </div>
                        <div class="stat-icon">
                            <i class="fas fa-download"></i>
                        </div>
                    </div>

                    <div class="stat-card" style="--from-color: #10b981; --to-color: #059669;">
                        <div class="stat-card-content">
                            <div class="stat-value" id="video-downloads">0</div>
                            <div class="stat-label">视频文件</div>
                            <div class="stat-footer">
                                <i class="fas fa-play-circle mr-2"></i>
                                <span>视频内容</span>
                            </div>
                        </div>
                        <div class="stat-icon">
                            <i class="fas fa-video"></i>
                        </div>
                    </div>

                    <div class="stat-card" style="--from-color: #8b5cf6; --to-color: #7c3aed;">
                        <div class="stat-card-content">
                            <div class="stat-value" id="recording-count">0</div>
                            <div class="stat-label">录制任务</div>
                            <div class="stat-footer">
                                <i class="fas fa-broadcast-tower mr-2"></i>
                                <span>直播录制</span>
                            </div>
                        </div>
                        <div class="stat-icon">
                            <i class="fas fa-record-vinyl"></i>
                        </div>
                    </div>

                    <div class="stat-card" style="--from-color: #f59e0b; --to-color: #d97706;">
                        <div class="stat-card-content">
                            <div class="stat-value" id="today-downloads">0</div>
                            <div class="stat-label">今日下载</div>
                            <div class="stat-footer">
                                <i class="fas fa-clock mr-2"></i>
                                <span>今日活动</span>
                            </div>
                        </div>
                        <div class="stat-icon">
                            <i class="fas fa-calendar-day"></i>
                        </div>
                    </div>
                </div>

                <!-- 选项卡导航 -->
                <div class="tab-nav">
                    <button class="tab-button active" data-tab="downloads">
                        <i class="fas fa-history mr-2"></i>下载历史
                    </button>
                    <button class="tab-button" data-tab="recordings">
                        <i class="fas fa-video mr-2"></i>录制管理
                    </button>
                    <button class="tab-button" data-tab="storage">
                        <i class="fas fa-hdd mr-2"></i>存储管理
                    </button>
                </div>

                <!-- 选项卡内容 -->
                <div class="tab-content active" id="downloads-tab">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-semibold">下载历史记录</h3>
                        <div class="flex gap-4">
                            <button id="refresh-downloads" class="btn btn-primary btn-sm">
                                <i class="fas fa-sync-alt mr-2"></i>刷新
                            </button>
                            <button id="clear-downloads" class="btn btn-danger btn-sm">
                                <i class="fas fa-trash mr-2"></i>清空历史
                            </button>
                        </div>
                    </div>
                    <div id="downloads-list"></div>
                </div>

                <div class="tab-content" id="recordings-tab">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-semibold">录制任务管理</h3>
                        <button id="refresh-recordings" class="btn btn-primary btn-sm">
                            <i class="fas fa-sync-alt mr-2"></i>刷新状态
                        </button>
                    </div>
                    <div id="recordings-list"></div>
                </div>

                <div class="tab-content" id="storage-tab">
                    <div class="flex justify-between items-center mb-6">
                        <h3 class="text-xl font-semibold">存储空间管理</h3>
                        <button id="open-folder" class="btn btn-success btn-sm">
                            <i class="fas fa-external-link-alt mr-2"></i>打开文件夹
                        </button>
                    </div>
                    <div id="storage-info"></div>
                </div>
            </div>
        `;
    }

    getSettingsContent() {
        return `
            <div class="card">
                <div class="card-header">
                    <h2 class="card-title">
                        <i class="fas fa-cog mr-4"></i>系统设置
                    </h2>
                    <p class="card-subtitle">配置API服务器、Cookie和其他选项</p>
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">API服务器地址</label>
                    <input type="text" id="api-server" class="form-input" value="http://127.0.0.1:5555">
                    <p class="text-sm text-gray-500 mt-2">修改后需要重新加载页面</p>
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">API Token (可选)</label>
                    <input type="password" id="api-token" class="form-input" placeholder="输入API访问令牌...">
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">抖音全局Cookie</label>
                    <textarea id="douyin-cookie" class="form-input" rows="3" placeholder="输入抖音Cookie..."></textarea>
                </div>
                
                <div class="form-group mb-6">
                    <label class="form-label">TikTok全局Cookie</label>
                    <textarea id="tiktok-cookie" class="form-input" rows="3" placeholder="输入TikTok Cookie..."></textarea>
                </div>
                
                <div class="flex gap-4">
                    <button id="save-settings" class="btn btn-primary">保存设置</button>
                    <button id="test-connection" class="btn btn-secondary">测试连接</button>
                </div>
                
                <div id="settings-status" class="mt-6"></div>
            </div>
        `;
    }
}

// 创建全局路由实例
window.router = new Router();
