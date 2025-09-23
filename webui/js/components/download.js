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
        const getInfoBtn = document.getElementById('get-work-info');
        const downloadBtn = document.getElementById('download-work');
        const workUrlInput = document.getElementById('work-url');

        if (getInfoBtn) {
            getInfoBtn.addEventListener('click', () => this.getWorkInfo());
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadWork());
        }

        if (workUrlInput) {
            workUrlInput.addEventListener('input', () => this.validateInput());
            workUrlInput.addEventListener('paste', () => {
                setTimeout(() => this.extractIdFromUrl(), 100);
            });
        }
    }

    /**
     * 加载全局Cookie
     */
    async loadGlobalCookie() {
        try {
            const settings = await api.getCookieSettings();
            if (settings.success) {
                // 不自动填充，保持用户选择
                console.log('全局Cookie已加载，可在需要时使用');
            }
        } catch (error) {
            console.warn('加载全局Cookie失败:', error);
        }
    }

    /**
     * 验证输入
     */
    validateInput() {
        const workUrl = document.getElementById('work-url')?.value.trim();
        const getInfoBtn = document.getElementById('get-work-info');
        
        if (getInfoBtn) {
            getInfoBtn.disabled = !workUrl;
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

        // 提取纯数字ID
        const workId = this.extractWorkId(workUrl);
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
    extractWorkId(input) {
        // 匹配19位数字ID
        const match = input.match(/(\d{19})/);
        return match ? match[1] : null;
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
     * 下载作品
     */
    async downloadWork() {
        if (!this.currentWorkData || !this.currentPlatform) {
            alert('请先获取作品信息');
            return;
        }

        const downloadBtn = document.getElementById('download-work');
        
        try {
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
                alert('没有可下载的链接！');
                return;
            }

            // 显示下载选项
            this.showDownloadOptions(downloadUrls);

        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败: ' + error.message);
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
