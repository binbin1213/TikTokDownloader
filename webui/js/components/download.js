/**
 * 单个作品下载组件
 */
class DownloadComponent {
    constructor() {
        this.currentWorkData = null;
        this.currentPlatform = null;
    }

    /**
     * 初始化组件
     */
    init() {
        this.bindEvents();
        this.loadGlobalCookie();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        const downloadBtn = document.getElementById('download-work');
        const workUrlInput = document.getElementById('work-url');
        const showCookieBtn = document.getElementById('show-cookie');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadWork());
        }

        if (workUrlInput) {
            workUrlInput.addEventListener('input', () => this.validateInput());
            workUrlInput.addEventListener('paste', () => {
                setTimeout(() => this.extractIdFromUrl(), 100);
            });
        }

        if (showCookieBtn) {
            showCookieBtn.addEventListener('click', () => this.toggleCookieDisplay());
        }
    }

    /**
     * 加载全局Cookie
     */
    async loadGlobalCookie() {
        try {
            const settings = await api.getCookieSettings();
            if (settings.success) {
                // 不自动填充Cookie，保护用户隐私
                console.log('全局Cookie已加载，可在需要时使用');
                this.globalCookieLoaded = true;
                this.updateCookieInputPlaceholder();
            }
        } catch (error) {
            console.warn('加载全局Cookie失败:', error);
            this.globalCookieLoaded = false;
        }
    }

    /**
     * 更新Cookie输入框占位符
     */
    updateCookieInputPlaceholder() {
        const cookieInput = document.getElementById('work-cookie');
        if (cookieInput && this.globalCookieLoaded) {
            cookieInput.placeholder = '已加载全局Cookie，留空将自动使用 (点击显示按钮查看)';
        }
    }

    /**
     * 脱敏显示Cookie
     */
    maskCookie(cookie) {
        if (!cookie || cookie.length < 20) {
            return cookie;
        }
        
        const start = cookie.substring(0, 10);
        const end = cookie.substring(cookie.length - 10);
        const masked = start + '*'.repeat(Math.min(20, cookie.length - 20)) + end;
        return masked;
    }

    /**
     * 加载Cookie到输入框（脱敏显示）
     */
    async toggleCookieDisplay() {
        const cookieInput = document.getElementById('work-cookie');
        const showCookieBtn = document.getElementById('show-cookie');
        const icon = showCookieBtn.querySelector('i');
        
        if (!this.globalCookieLoaded) {
            alert('未加载全局Cookie');
            return;
        }

        try {
            const settings = await api.getCookieSettings();
            if (!settings.success) {
                alert('获取Cookie失败');
                return;
            }

            // 检测当前平台
            const workUrl = document.getElementById('work-url')?.value.trim() || '';
            const platform = this.detectPlatform(workUrl) || 'douyin';
            const cookie = platform === 'douyin' ? settings.douyin_cookie : settings.tiktok_cookie;

            if (!cookie) {
                alert(`未设置${platform === 'douyin' ? '抖音' : 'TikTok'}的全局Cookie`);
                return;
            }

            // 如果已经加载了脱敏Cookie，则清空
            if (cookieInput.value === this.maskCookie(cookie)) {
                cookieInput.value = '';
                cookieInput.placeholder = '输入Cookie以获取更多信息...';
                icon.className = 'fas fa-download';
                showCookieBtn.title = '加载全局Cookie';
            } else {
                // 显示脱敏Cookie，但实际存储完整Cookie供内部使用
                cookieInput.value = this.maskCookie(cookie);
                cookieInput.placeholder = '已加载全局Cookie (脱敏显示)';
                icon.className = 'fas fa-times';
                showCookieBtn.title = '清除Cookie';
                
                // 存储完整Cookie供内部使用
                cookieInput.dataset.fullCookie = cookie;
            }
        } catch (error) {
            console.error('加载Cookie失败:', error);
            alert('操作失败');
        }
    }

    /**
     * 验证输入
     */
    validateInput() {
        const workUrl = document.getElementById('work-url')?.value.trim();
        const downloadBtn = document.getElementById('download-work');
        
        if (downloadBtn) {
            downloadBtn.disabled = !workUrl;
        }
    }

    /**
     * 从URL中提取作品ID
     */
    extractIdFromUrl() {
        const workUrlInput = document.getElementById('work-url');
        if (!workUrlInput) return;

        const url = workUrlInput.value.trim();
        if (!url) return;

        // 抖音链接模式
        const douyinPatterns = [
            /(?:douyin\.com\/video\/|v\.douyin\.com\/[A-Za-z0-9]+\/?).*?(\d{19})/,
            /(?:douyin\.com\/.*?video\/|aweme\/v1\/aweme\/detail\/\?aweme_id=)(\d{19})/,
            /(\d{19})/
        ];

        // TikTok链接模式
        const tiktokPatterns = [
            /(?:tiktok\.com\/@[^\/]+\/video\/|vm\.tiktok\.com\/[A-Za-z0-9]+\/?).*?(\d{19})/,
            /(?:tiktok\.com\/.*?video\/|t\.tiktok\.com\/)(\d{19})/,
            /(\d{19})/
        ];

        // 判断平台并提取ID
        if (url.includes('douyin.com') || url.includes('iesdouyin.com')) {
            for (const pattern of douyinPatterns) {
                const match = url.match(pattern);
                if (match) {
                    workUrlInput.value = match[1];
                    this.showPlatformHint('douyin');
                    break;
                }
            }
        } else if (url.includes('tiktok.com')) {
            for (const pattern of tiktokPatterns) {
                const match = url.match(pattern);
                if (match) {
                    workUrlInput.value = match[1];
                    this.showPlatformHint('tiktok');
                    break;
                }
            }
        }

        this.validateInput();
    }

    /**
     * 显示平台提示
     */
    showPlatformHint(platform) {
        const existingHint = document.querySelector('.platform-hint');
        if (existingHint) existingHint.remove();

        const workUrlInput = document.getElementById('work-url');
        if (!workUrlInput) return;

        const hint = document.createElement('div');
        hint.className = 'platform-hint text-sm text-blue-600 mt-1';
        hint.innerHTML = `<i class="fas fa-info-circle mr-1"></i>检测到${platform === 'douyin' ? '抖音' : 'TikTok'}平台`;
        
        workUrlInput.parentNode.appendChild(hint);
        
        setTimeout(() => hint.remove(), 3000);
    }

    /**
     * 获取作品信息
     */
    async getWorkInfo() {
        const workUrl = document.getElementById('work-url')?.value.trim();
        const cookie = document.getElementById('work-cookie')?.value.trim() || '';
        const getInfoBtn = document.getElementById('get-work-info');
        const downloadBtn = document.getElementById('download-work');
        const resultDiv = document.getElementById('work-result');

        if (!workUrl) {
            alert('请输入作品链接或ID');
            return;
        }

        // 确定平台
        const platform = this.detectPlatform(workUrl);
        if (!platform) {
            alert('无法识别平台，请确认输入的是抖音或TikTok链接/ID');
            return;
        }

        this.currentPlatform = platform;

        // 提取纯数字ID（支持短链接）
        const workId = await this.extractWorkId(workUrl);
        if (!workId) {
            alert('无法提取作品ID，请确认输入格式正确');
            return;
        }

        try {
            // 更新按钮状态
            if (getInfoBtn) {
                getInfoBtn.disabled = true;
                getInfoBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>获取中...';
            }

            // 获取全局Cookie（如果用户没有手动输入）
            let finalCookie = cookie;
            if (!finalCookie) {
                finalCookie = await this.getGlobalCookie(platform);
            }

            // 调用API获取作品信息
            const result = await api.getWorkDetail(platform, workId, finalCookie);

            if (result.message === '获取数据成功！' && result.data) {
                this.currentWorkData = result.data;
                this.displayWorkInfo(result.data, platform);
                
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                }
            } else {
                throw new Error(result.message || '获取作品信息失败');
            }

        } catch (error) {
            console.error('获取作品信息失败:', error);
            
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <div class="card border-red-200 bg-red-50">
                        <div class="text-red-800">
                            <h3 class="font-semibold mb-2">
                                <i class="fas fa-exclamation-triangle mr-2"></i>获取失败
                            </h3>
                            <p class="text-sm mb-3">${error.message}</p>
                            ${!cookie ? `
                                <div class="bg-red-100 border border-red-200 rounded p-3 text-xs">
                                    <strong>💡 建议:</strong> 尝试添加Cookie以获取更多信息
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                resultDiv.classList.remove('hidden');
            }

        } finally {
            // 恢复按钮状态
            if (getInfoBtn) {
                getInfoBtn.disabled = false;
                getInfoBtn.innerHTML = '获取作品信息';
            }
        }
    }

    /**
     * 检测平台
     */
    detectPlatform(input) {
        if (input.includes('douyin.com') || input.includes('iesdouyin.com')) {
            return 'douyin';
        } else if (input.includes('tiktok.com')) {
            return 'tiktok';
        }
        
        // 如果是纯数字，默认为抖音（可以根据需要调整）
        if (/^\d{19}$/.test(input)) {
            return 'douyin';
        }
        
        return null;
    }

    /**
     * 提取作品ID
     */
    async extractWorkId(input) {
        // 首先尝试直接匹配19位数字ID
        const directMatch = input.match(/(\d{19})/);
        if (directMatch) {
            console.log('🔍 直接提取到作品ID:', directMatch[1]);
            return directMatch[1];
        }
        
        // 检查是否包含短链接
        const shortLinkMatch = input.match(/https:\/\/v\.douyin\.com\/([A-Za-z0-9_-]+)/);
        if (shortLinkMatch) {
            console.log('🔗 检测到短链接:', shortLinkMatch[0]);
            try {
                // 发送到后端解析短链接
                const result = await api.extractWorkId(input);
                if (result.success && result.work_ids && result.work_ids.length > 0) {
                    console.log('🎯 短链接解析成功，提取到ID:', result.work_ids[0]);
                    return result.work_ids[0];
                } else {
                    console.warn('🔗 短链接解析失败:', result);
                }
            } catch (error) {
                console.error('🔗 短链接解析出错:', error);
            }
        }
        
        console.warn('❌ 无法提取作品ID from:', input);
        return null;
    }

    /**
     * 获取全局Cookie
     */
    async getGlobalCookie(platform) {
        try {
            console.log('🍪 尝试获取全局Cookie for platform:', platform);
            const settings = await api.getCookieSettings();
            console.log('🍪 Cookie设置响应:', settings);
            
            if (settings.success) {
                const cookie = platform === 'douyin' ? settings.douyin_cookie : settings.tiktok_cookie;
                console.log('🍪 获取到的Cookie长度:', cookie ? cookie.length : 0);
                return cookie || '';
            } else {
                console.warn('🍪 Cookie设置响应不成功:', settings);
            }
        } catch (error) {
            console.error('🍪 获取全局Cookie失败:', error);
        }
        return '';
    }

    /**
     * 显示作品信息
     */
    displayWorkInfo(data, platform) {
        const resultDiv = document.getElementById('work-result');
        if (!resultDiv) return;

        const platformIcon = platform === 'douyin' ? '🎵' : '🎬';
        const platformName = platform === 'douyin' ? '抖音' : 'TikTok';
        
        // 处理下载链接
        let downloadUrls = [];
        if (data.downloads) {
            if (typeof data.downloads === 'string') {
                downloadUrls = [data.downloads];
            } else if (Array.isArray(data.downloads)) {
                downloadUrls = data.downloads;
            }
        }

        const html = `
            <div class="card border-green-200 bg-green-50">
                <div class="text-green-800">
                    <h3 class="font-semibold mb-4">
                        <i class="fas fa-check-circle mr-2"></i>作品信息获取成功
                    </h3>
                    
                    <div class="bg-white rounded-lg p-4 mb-4 border border-green-200">
                        <div class="flex items-start mb-3">
                            <span class="text-3xl mr-4">${platformIcon}</span>
                            <div class="flex-1">
                                <h4 class="font-semibold text-gray-900 mb-2">${data.desc || data.title || '未知标题'}</h4>
                                <div class="text-sm text-gray-600 space-y-1">
                                    <div><i class="fas fa-user mr-2"></i>作者: ${data.nickname || data.author || '未知作者'}</div>
                                    <div><i class="fas fa-clock mr-2"></i>时长: ${data.duration || '未知'}</div>
                                    <div><i class="fas fa-calendar mr-2"></i>发布时间: ${data.create_time || '未知'}</div>
                                    <div><i class="fas fa-eye mr-2"></i>播放量: ${data.play_count > 0 ? data.play_count : '未知'}</div>
                                </div>
                            </div>
                        </div>
                        
                        ${data.static_cover || data.dynamic_cover ? `
                            <div class="mb-3">
                                <img src="${data.static_cover || data.dynamic_cover}" 
                                     alt="作品封面" 
                                     class="w-32 h-32 object-cover rounded-lg border border-gray-200">
                            </div>
                        ` : ''}
                        
                        <div class="flex items-center justify-between text-sm text-gray-600">
                            <span><i class="fas fa-thumbs-up mr-1"></i>点赞: ${data.digg_count || 0}</span>
                            <span><i class="fas fa-comment mr-1"></i>评论: ${data.comment_count || 0}</span>
                            <span><i class="fas fa-share mr-1"></i>分享: ${data.share_count || 0}</span>
                        </div>
                    </div>
                    
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <h5 class="font-semibold text-blue-800 mb-2">
                            <i class="fas fa-download mr-2"></i>下载选项
                        </h5>
                        <div class="text-sm text-blue-700">
                            <div class="mb-2">平台: ${platformName}</div>
                            <div class="mb-2">文件数量: ${downloadUrls.length} 个</div>
                            <div>类型: ${data.type || (data.duration ? 'video' : 'unknown')}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        resultDiv.innerHTML = html;
        resultDiv.classList.remove('hidden');

        // 检查是否已下载
        this.checkIfDownloaded(data.desc || data.title || '未知标题', data.nickname || data.author || '未知作者', platform);
    }

    /**
     * 检查文件是否已下载
     */
    async checkIfDownloaded(title, author, platform) {
        try {
            const result = await api.checkDownloaded(title, author, platform);
            
            if (result.exists) {
                const resultDiv = document.getElementById('work-result');
                if (resultDiv) {
                    const statusDiv = document.createElement('div');
                    statusDiv.className = 'mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg';
                    statusDiv.innerHTML = `
                        <div class="text-yellow-800 text-sm">
                            <i class="fas fa-info-circle mr-2"></i>
                            <strong>提示:</strong> 该文件可能已存在于服务器中
                        </div>
                    `;
                    resultDiv.appendChild(statusDiv);
                }
            }
        } catch (error) {
            console.warn('检查文件状态失败:', error);
        }
    }

    /**
     * 下载作品（合并获取信息和下载逻辑）
     */
    async downloadWork() {
        const workUrl = document.getElementById('work-url')?.value.trim();
        const cookie = document.getElementById('work-cookie')?.value.trim() || '';
        const downloadBtn = document.getElementById('download-work');

        if (!workUrl) {
            alert('请输入作品链接或ID');
            return;
        }

        try {
            // 更新按钮状态
            if (downloadBtn) {
                downloadBtn.disabled = true;
                downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>获取作品信息中...';
            }

            // 第一步：获取作品信息
            await this.getWorkInfoForDownload(workUrl, cookie);
            
            // 第二步：弹出下载位置选择对话框
            const downloadChoice = await this.showDownloadLocationDialog();
            
            // 第三步：根据选择执行下载
            if (downloadChoice === 'local') {
                await this.downloadToLocal();
            } else if (downloadChoice === 'server') {
                await this.downloadToServer();
            }
            
        } catch (error) {
            console.error('下载失败:', error);
            alert(`下载失败: ${error.message}`);
        } finally {
            // 恢复按钮状态
            if (downloadBtn) {
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fas fa-download mr-2"></i>下载作品';
            }
        }
    }

    /**
     * 获取作品信息（用于下载）
     */
    async getWorkInfoForDownload(workUrl, cookie) {
        // 检测平台
        const platform = this.detectPlatform(workUrl);
        if (!platform) {
            throw new Error('不支持的平台或链接格式');
        }

        this.currentPlatform = platform;

        // 提取作品ID（支持短链接）
        const workId = await this.extractWorkId(workUrl);
        if (!workId) {
            throw new Error('无法提取作品ID，请确认输入格式正确');
        }

        // 获取最终Cookie
        let finalCookie = this.getEffectiveCookie(cookie);
        if (!finalCookie) {
            finalCookie = await this.getGlobalCookie(platform);
        }

        // 调用API获取作品信息
        console.log('🔍 调用API获取作品详情:', {
            platform,
            workId,
            hasCookie: !!finalCookie,
            cookieLength: finalCookie ? finalCookie.length : 0
        });
        
        const result = await api.getWorkDetail(platform, workId, finalCookie);
        
        console.log('📡 API响应结果:', {
            success: result.success,
            message: result.message,
            hasData: !!result.data,
            dataKeys: result.data ? Object.keys(result.data) : []
        });

        if (result.message === '获取数据成功！' && result.data) {
            this.currentWorkData = result.data;
            return result.data;
        } else {
            console.error('❌ API调用失败详情:', result);
            throw new Error(result.message || '获取作品信息失败');
        }
    }

    /**
     * 获取有效的Cookie（处理脱敏显示的情况）
     */
    getEffectiveCookie(inputCookie) {
        if (!inputCookie) {
            return '';
        }

        const cookieInput = document.getElementById('work-cookie');
        
        // 如果输入的是脱敏Cookie，使用存储的完整Cookie
        if (cookieInput && cookieInput.dataset.fullCookie && inputCookie.includes('*')) {
            return cookieInput.dataset.fullCookie;
        }
        
        // 否则使用用户输入的Cookie
        return inputCookie;
    }

    /**
     * 显示下载位置选择对话框
     */
    async showDownloadLocationDialog() {
        return new Promise((resolve) => {
            // 创建模态对话框
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
                    <div class="text-center mb-6">
                        <i class="fas fa-download text-4xl text-blue-500 mb-3"></i>
                        <h3 class="text-lg font-semibold text-gray-800 mb-2">选择下载位置</h3>
                        <p class="text-gray-600 text-sm">请选择将作品下载到哪里</p>
                    </div>
                    
                    <div class="space-y-3">
                        <button id="download-local" class="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center">
                            <i class="fas fa-laptop mr-2"></i>
                            下载到本地
                        </button>
                        <button id="download-server" class="w-full p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center">
                            <i class="fas fa-server mr-2"></i>
                            下载到服务器
                        </button>
                        <button id="download-cancel" class="w-full p-2 text-gray-500 hover:text-gray-700 transition-colors">
                            取消
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // 绑定事件
            modal.querySelector('#download-local').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve('local');
            });

            modal.querySelector('#download-server').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve('server');
            });

            modal.querySelector('#download-cancel').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });

            // 点击背景关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(null);
                }
            });
        });
    }

    /**
     * 下载到本地
     */
    async downloadToLocal() {
        if (!this.currentWorkData) {
            throw new Error('没有作品数据');
        }
        
            // 处理下载链接
            let downloadUrls = [];
            if (this.currentWorkData.downloads) {
                if (typeof this.currentWorkData.downloads === 'string') {
                    downloadUrls = [this.currentWorkData.downloads];
                } else if (Array.isArray(this.currentWorkData.downloads)) {
                    downloadUrls = this.currentWorkData.downloads;
                }
            }

            if (downloadUrls.length === 0) {
            throw new Error('没有可下载的链接！');
        }

        // 浏览器下载
        console.log('🖥️ 开始浏览器下载，链接数量:', downloadUrls.length);
        for (let i = 0; i < downloadUrls.length; i++) {
            const url = downloadUrls[i];
            const link = document.createElement('a');
            link.href = url;
            link.download = `${this.currentWorkData.desc || 'video'}_${i + 1}`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 如果有多个文件，稍微延迟一下避免浏览器阻止
            if (i < downloadUrls.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        alert(`开始下载 ${downloadUrls.length} 个文件到本地！`);
    }

    /**
     * 下载到服务器
     */
    async downloadToServer() {
        if (!this.currentWorkData || !this.currentPlatform) {
            throw new Error('没有作品数据');
        }

        console.log('🖥️ 开始服务器下载');
        
        // 获取下载链接
        let downloadUrls = [];
        if (this.currentWorkData.downloads) {
            if (typeof this.currentWorkData.downloads === 'string') {
                downloadUrls = [this.currentWorkData.downloads];
            } else if (Array.isArray(this.currentWorkData.downloads)) {
                downloadUrls = this.currentWorkData.downloads;
            }
        }

        if (downloadUrls.length === 0) {
            throw new Error('没有可下载的链接！');
        }

        // 调用服务器下载API
        const result = await api.downloadToServer(
            downloadUrls[0], // 使用第一个下载链接
            this.currentPlatform,
            this.currentWorkData.desc || 'video',
            this.currentWorkData.nickname || 'unknown'
        );

        if (result.success) {
            alert('已开始下载到服务器！可在文件管理中查看下载进度。');
        } else {
            throw new Error(result.message || '服务器下载失败');
        }
    }

    /**
     * 显示下载选项
     */
    showDownloadOptions(downloadUrls) {
        const resultDiv = document.getElementById('work-result');
        if (!resultDiv) return;

        const optionsHtml = `
            <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 class="font-semibold text-blue-800 mb-3">
                    <i class="fas fa-download mr-2"></i>选择下载方式
                </h5>
                <div class="flex gap-3 mb-4">
                    <button onclick="downloadComponent.downloadToServer()" 
                            class="btn btn-success flex-1">
                        <i class="fas fa-server mr-2"></i>下载到服务器
                    </button>
                    <button onclick="downloadComponent.downloadToBrowser()" 
                            class="btn btn-primary flex-1">
                        <i class="fas fa-download mr-2"></i>浏览器下载
                    </button>
                </div>
                <p class="text-xs text-blue-600">
                    <i class="fas fa-info-circle mr-1"></i>
                    服务器下载：文件保存到服务器，可在文件管理中查看<br>
                    浏览器下载：直接下载到本地默认下载文件夹
                </p>
            </div>
        `;

        resultDiv.insertAdjacentHTML('beforeend', optionsHtml);
    }

    /**
     * 下载到服务器
     */
    async downloadToServer() {
        if (!this.currentWorkData || !this.currentPlatform) return;

        try {
            const title = this.currentWorkData.desc || this.currentWorkData.title || '未知标题';
            const author = this.currentWorkData.nickname || this.currentWorkData.author || '未知作者';
            
            // 获取第一个下载链接
            let downloadUrl = '';
            if (this.currentWorkData.downloads) {
                if (typeof this.currentWorkData.downloads === 'string') {
                    downloadUrl = this.currentWorkData.downloads;
                } else if (Array.isArray(this.currentWorkData.downloads)) {
                    downloadUrl = this.currentWorkData.downloads[0];
                }
            }

            if (!downloadUrl) {
                alert('没有可下载的链接！');
                return;
            }

            const result = await api.downloadToServer(downloadUrl, this.currentPlatform, title, author);
            
            if (result.success) {
                alert(`✅ 开始下载到服务器！\n\n📁 保存路径: ${result.file_path}\n💡 可在文件管理中查看进度`);
                
                // 记录下载历史
                await this.recordDownload(this.currentWorkData, this.currentPlatform, 'single');
                
            } else {
                alert(`❌ 下载失败！\n\n错误信息: ${result.message}`);
            }

        } catch (error) {
            console.error('服务器下载失败:', error);
            alert('服务器下载失败: ' + error.message);
        }
    }

    /**
     * 浏览器下载
     */
    downloadToBrowser() {
        if (!this.currentWorkData) return;

        let downloadUrls = [];
        if (this.currentWorkData.downloads) {
            if (typeof this.currentWorkData.downloads === 'string') {
                downloadUrls = [this.currentWorkData.downloads];
            } else if (Array.isArray(this.currentWorkData.downloads)) {
                downloadUrls = this.currentWorkData.downloads;
            }
        }

        if (downloadUrls.length === 0) {
            alert('没有可下载的链接！');
            return;
        }

        // 创建下载链接
        downloadUrls.forEach((url, index) => {
            const link = document.createElement('a');
            link.href = url;
            link.download = `${this.currentWorkData.desc || 'download'}_${index + 1}`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        alert(`✅ 开始浏览器下载！\n\n📥 共 ${downloadUrls.length} 个文件\n💾 文件将保存到浏览器默认下载文件夹`);

        // 记录下载历史
        this.recordDownload(this.currentWorkData, this.currentPlatform, 'single');
    }

    /**
     * 记录下载历史
     */
    async recordDownload(workData, platform, downloadType) {
        try {
            // 处理下载链接
            let downloadUrls = [];
            if (workData.downloads) {
                if (typeof workData.downloads === 'string') {
                    downloadUrls = [workData.downloads];
                } else if (Array.isArray(workData.downloads)) {
                    downloadUrls = workData.downloads;
                }
            }

            // 准备数据库数据
            const recordData = {
                title: workData.desc || workData.title || '未知标题',
                author: workData.nickname || workData.author || '未知作者',
                platform: platform,
                download_urls: JSON.stringify(downloadUrls),
                download_type: downloadType,
                work_id: workData.id || workData.aweme_id || Date.now().toString(),
                thumbnail_url: workData.static_cover || workData.dynamic_cover || '',
                duration: workData.duration || '',
                tags: JSON.stringify(workData.text_extra || workData.tag || [])
            };

            // 保存到数据库
            const result = await api.saveDownloadHistory(recordData);
            
            if (result.success) {
                console.log('✅ 下载历史已保存到数据库');
            } else {
                console.warn('⚠️ 保存到数据库失败，使用本地存储');
                this.saveToLocalStorage(workData, platform, downloadType);
            }

        } catch (error) {
            console.error('保存下载历史失败:', error);
            this.saveToLocalStorage(workData, platform, downloadType);
        }
    }

    /**
     * 保存到本地存储（备用方案）
     */
    saveToLocalStorage(workData, platform, downloadType) {
        const history = JSON.parse(localStorage.getItem('download-history') || '[]');
        
        let downloadUrls = [];
        if (workData.downloads) {
            if (typeof workData.downloads === 'string') {
                downloadUrls = [workData.downloads];
            } else if (Array.isArray(workData.downloads)) {
                downloadUrls = workData.downloads;
            }
        }
        
        const record = {
            id: Date.now(),
            title: workData.desc || workData.title || '未知标题',
            author: workData.nickname || workData.author || '未知作者',
            platform: platform,
            downloads: downloadUrls,
            downloadType: downloadType,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('zh-CN')
        };
        
        history.unshift(record);
        
        if (history.length > 100) {
            history.splice(100);
        }
        
        localStorage.setItem('download-history', JSON.stringify(history));
    }
}

// 创建全局下载组件实例
window.DownloadComponent = DownloadComponent;
window.downloadComponent = new DownloadComponent();
