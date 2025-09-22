/**
 * 账号作品下载组件
 */
class AccountComponent {
    constructor() {
        this.currentAccountData = null;
        this.currentPlatform = null;
        this.selectedWorks = new Set();
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
        const getInfoBtn = document.getElementById('get-account-info');
        const downloadBtn = document.getElementById('download-account');
        const accountUrlInput = document.getElementById('account-url');

        if (getInfoBtn) {
            getInfoBtn.addEventListener('click', () => this.getAccountInfo());
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadSelected());
        }

        if (accountUrlInput) {
            accountUrlInput.addEventListener('input', () => this.validateInput());
            accountUrlInput.addEventListener('paste', () => {
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
                const cookieInput = document.getElementById('account-cookie');
                if (cookieInput && !cookieInput.value) {
                    // 检测当前可能的平台并加载对应Cookie
                    const accountUrl = document.getElementById('account-url')?.value || '';
                    const platform = this.detectPlatform(accountUrl);
                    if (platform) {
                        const cookie = platform === 'douyin' ? settings.douyin_cookie : settings.tiktok_cookie;
                        if (cookie) {
                            cookieInput.value = cookie;
                            this.showCookieHint('已自动加载全局Cookie');
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('加载全局Cookie失败:', error);
        }
    }

    /**
     * 验证输入
     */
    validateInput() {
        const accountUrl = document.getElementById('account-url')?.value.trim();
        const cookie = document.getElementById('account-cookie')?.value.trim();
        const getInfoBtn = document.getElementById('get-account-info');
        
        if (getInfoBtn) {
            getInfoBtn.disabled = !accountUrl || !cookie;
        }

        // 如果URL改变，尝试加载对应平台的Cookie
        if (accountUrl) {
            this.tryLoadPlatformCookie(accountUrl);
        }
    }

    /**
     * 尝试加载平台对应的Cookie
     */
    async tryLoadPlatformCookie(url) {
        const platform = this.detectPlatform(url);
        const cookieInput = document.getElementById('account-cookie');
        
        if (platform && cookieInput && !cookieInput.value) {
            try {
                const settings = await api.getCookieSettings();
                if (settings.success) {
                    const cookie = platform === 'douyin' ? settings.douyin_cookie : settings.tiktok_cookie;
                    if (cookie) {
                        cookieInput.value = cookie;
                        this.showCookieHint(`已自动加载${platform === 'douyin' ? '抖音' : 'TikTok'}全局Cookie`);
                    }
                }
            } catch (error) {
                console.warn('加载平台Cookie失败:', error);
            }
        }
    }

    /**
     * 显示Cookie提示
     */
    showCookieHint(message) {
        const existingHint = document.querySelector('.cookie-hint');
        if (existingHint) existingHint.remove();

        const cookieInput = document.getElementById('account-cookie');
        if (!cookieInput) return;

        const hint = document.createElement('div');
        hint.className = 'cookie-hint text-sm text-green-600 mt-1';
        hint.innerHTML = `<i class="fas fa-check-circle mr-1"></i>${message}`;
        
        cookieInput.parentNode.appendChild(hint);
        
        setTimeout(() => hint.remove(), 3000);
    }

    /**
     * 从URL中提取用户ID
     */
    extractIdFromUrl() {
        const accountUrlInput = document.getElementById('account-url');
        if (!accountUrlInput) return;

        const url = accountUrlInput.value.trim();
        if (!url) return;

        // 抖音用户链接模式
        const douyinPatterns = [
            /douyin\.com\/user\/([A-Za-z0-9_-]+)/,
            /v\.douyin\.com\/([A-Za-z0-9]+)/
        ];

        // TikTok用户链接模式
        const tiktokPatterns = [
            /tiktok\.com\/@([A-Za-z0-9._-]+)/,
            /vm\.tiktok\.com\/([A-Za-z0-9]+)/
        ];

        // 判断平台并提取用户名/ID
        if (url.includes('douyin.com')) {
            for (const pattern of douyinPatterns) {
                const match = url.match(pattern);
                if (match) {
                    // 对于抖音，通常需要sec_uid，这里保持原链接
                    this.showPlatformHint('douyin');
                    break;
                }
            }
        } else if (url.includes('tiktok.com')) {
            for (const pattern of tiktokPatterns) {
                const match = url.match(pattern);
                if (match) {
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

        const accountUrlInput = document.getElementById('account-url');
        if (!accountUrlInput) return;

        const hint = document.createElement('div');
        hint.className = 'platform-hint text-sm text-blue-600 mt-1';
        hint.innerHTML = `<i class="fas fa-info-circle mr-1"></i>检测到${platform === 'douyin' ? '抖音' : 'TikTok'}平台`;
        
        accountUrlInput.parentNode.appendChild(hint);
        
        setTimeout(() => hint.remove(), 3000);
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
        return null;
    }

    /**
     * 获取账号信息
     */
    async getAccountInfo() {
        const accountUrl = document.getElementById('account-url')?.value.trim();
        const cookie = document.getElementById('account-cookie')?.value.trim();
        const getInfoBtn = document.getElementById('get-account-info');
        const downloadBtn = document.getElementById('download-account');
        const resultDiv = document.getElementById('account-result');

        if (!accountUrl) {
            alert('请输入用户链接或ID');
            return;
        }

        if (!cookie) {
            alert('获取账号作品需要Cookie，请先设置Cookie');
            return;
        }

        // 确定平台
        const platform = this.detectPlatform(accountUrl);
        if (!platform) {
            alert('无法识别平台，请确认输入的是抖音或TikTok用户链接');
            return;
        }

        this.currentPlatform = platform;

        try {
            // 更新按钮状态
            if (getInfoBtn) {
                getInfoBtn.disabled = true;
                getInfoBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>获取中...';
            }

            // 提取用户ID（这里简化处理，实际可能需要更复杂的提取逻辑）
            const accountId = this.extractAccountId(accountUrl);

            // 调用API获取账号作品
            const result = await api.getAccountWorks(platform, accountId, cookie);

            if (result.message === '获取数据成功！' && result.data) {
                this.currentAccountData = result.data;
                this.displayAccountWorks(result.data, platform);
                
                if (downloadBtn) {
                    downloadBtn.disabled = false;
                }
            } else {
                throw new Error(result.message || '获取账号作品失败');
            }

        } catch (error) {
            console.error('获取账号信息失败:', error);
            
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <div class="card border-red-200 bg-red-50">
                        <div class="text-red-800">
                            <h3 class="font-semibold mb-2">
                                <i class="fas fa-exclamation-triangle mr-2"></i>获取失败
                            </h3>
                            <p class="text-sm mb-3">${error.message}</p>
                            <div class="bg-red-100 border border-red-200 rounded p-3 text-xs">
                                <strong>💡 可能原因:</strong><br>
                                • Cookie已过期或无效<br>
                                • 用户设置了隐私保护<br>
                                • 网络连接问题<br>
                                • 用户ID格式不正确
                            </div>
                        </div>
                    </div>
                `;
                resultDiv.classList.remove('hidden');
            }

        } finally {
            // 恢复按钮状态
            if (getInfoBtn) {
                getInfoBtn.disabled = false;
                getInfoBtn.innerHTML = '获取账号信息';
            }
        }
    }

    /**
     * 提取账号ID
     */
    extractAccountId(input) {
        // 这里简化处理，实际项目中可能需要更复杂的ID提取逻辑
        // 对于完整的URL，直接返回，让后端处理
        if (input.startsWith('http')) {
            return input;
        }
        return input;
    }

    /**
     * 显示账号作品
     */
    displayAccountWorks(data, platform) {
        const resultDiv = document.getElementById('account-result');
        if (!resultDiv) return;

        const platformIcon = platform === 'douyin' ? '🎵' : '🎬';
        const platformName = platform === 'douyin' ? '抖音' : 'TikTok';
        
        // 如果data是数组，说明是作品列表
        const works = Array.isArray(data) ? data : (data.aweme_list || data.itemList || []);
        
        if (!works || works.length === 0) {
            resultDiv.innerHTML = `
                <div class="card border-yellow-200 bg-yellow-50">
                    <div class="text-yellow-800">
                        <h3 class="font-semibold mb-2">
                            <i class="fas fa-info-circle mr-2"></i>没有找到作品
                        </h3>
                        <p class="text-sm">该用户可能没有公开作品或需要更高权限的Cookie</p>
                    </div>
                </div>
            `;
            resultDiv.classList.remove('hidden');
            return;
        }

        let html = `
            <div class="card border-green-200 bg-green-50">
                <div class="text-green-800">
                    <h3 class="font-semibold mb-4">
                        <i class="fas fa-check-circle mr-2"></i>找到 ${works.length} 个作品
                    </h3>
                    
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex gap-2">
                            <button onclick="accountComponent.selectAll()" class="btn btn-sm btn-secondary">
                                <i class="fas fa-check-square mr-1"></i>全选
                            </button>
                            <button onclick="accountComponent.selectNone()" class="btn btn-sm btn-secondary">
                                <i class="fas fa-square mr-1"></i>全不选
                            </button>
                        </div>
                        <div class="text-sm">
                            已选择: <span id="selected-count">0</span> / ${works.length}
                        </div>
                    </div>
                    
                    <div class="max-h-96 overflow-y-auto space-y-3">
        `;

        works.forEach((work, index) => {
            const title = work.desc || work.title || `作品 ${index + 1}`;
            const author = work.author?.nickname || work.nickname || '未知作者';
            const duration = work.duration || '未知';
            const createTime = work.create_time || work.createTime || '';
            const cover = work.video?.cover || work.cover || work.static_cover || '';
            
            html += `
                <div class="work-item bg-white border border-gray-200 rounded-lg p-3">
                    <div class="flex items-start">
                        <div class="flex-shrink-0 mr-3">
                            <input type="checkbox" 
                                   id="work-${index}" 
                                   data-index="${index}"
                                   onchange="accountComponent.toggleWork(${index})"
                                   class="work-checkbox">
                        </div>
                        
                        ${cover ? `
                            <div class="flex-shrink-0 mr-3">
                                <img src="${cover}" alt="封面" 
                                     class="w-16 h-16 object-cover rounded border border-gray-200">
                            </div>
                        ` : ''}
                        
                        <div class="flex-1">
                            <h5 class="font-medium text-gray-900 mb-1">${title}</h5>
                            <div class="text-sm text-gray-600 space-y-1">
                                <div><i class="fas fa-user mr-2"></i>${author}</div>
                                <div><i class="fas fa-clock mr-2"></i>时长: ${duration}</div>
                                ${createTime ? `<div><i class="fas fa-calendar mr-2"></i>${createTime}</div>` : ''}
                                <div class="flex gap-4 text-xs">
                                    <span><i class="fas fa-thumbs-up mr-1"></i>${work.statistics?.diggCount || work.digg_count || 0}</span>
                                    <span><i class="fas fa-comment mr-1"></i>${work.statistics?.commentCount || work.comment_count || 0}</span>
                                    <span><i class="fas fa-share mr-1"></i>${work.statistics?.shareCount || work.share_count || 0}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                    </div>
                </div>
            </div>
        `;

        resultDiv.innerHTML = html;
        resultDiv.classList.remove('hidden');
        
        this.selectedWorks.clear();
        this.updateSelectedCount();
    }

    /**
     * 切换作品选择状态
     */
    toggleWork(index) {
        const checkbox = document.getElementById(`work-${index}`);
        if (!checkbox) return;

        if (checkbox.checked) {
            this.selectedWorks.add(index);
        } else {
            this.selectedWorks.delete(index);
        }

        this.updateSelectedCount();
        this.updateDownloadButton();
    }

    /**
     * 全选
     */
    selectAll() {
        document.querySelectorAll('.work-checkbox').forEach((checkbox, index) => {
            checkbox.checked = true;
            this.selectedWorks.add(parseInt(checkbox.dataset.index));
        });
        this.updateSelectedCount();
        this.updateDownloadButton();
    }

    /**
     * 全不选
     */
    selectNone() {
        document.querySelectorAll('.work-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.selectedWorks.clear();
        this.updateSelectedCount();
        this.updateDownloadButton();
    }

    /**
     * 更新选中数量显示
     */
    updateSelectedCount() {
        const countElement = document.getElementById('selected-count');
        if (countElement) {
            countElement.textContent = this.selectedWorks.size;
        }
    }

    /**
     * 更新下载按钮状态
     */
    updateDownloadButton() {
        const downloadBtn = document.getElementById('download-account');
        if (downloadBtn) {
            downloadBtn.disabled = this.selectedWorks.size === 0;
            downloadBtn.innerHTML = this.selectedWorks.size > 0 
                ? `<i class="fas fa-download mr-2"></i>下载选中的 ${this.selectedWorks.size} 个作品`
                : '<i class="fas fa-download mr-2"></i>批量下载';
        }
    }

    /**
     * 下载选中的作品
     */
    async downloadSelected() {
        if (!this.currentAccountData || this.selectedWorks.size === 0) {
            alert('请先选择要下载的作品');
            return;
        }

        const works = Array.isArray(this.currentAccountData) ? this.currentAccountData : 
                     (this.currentAccountData.aweme_list || this.currentAccountData.itemList || []);

        const selectedWorks = Array.from(this.selectedWorks).map(index => works[index]).filter(Boolean);

        if (selectedWorks.length === 0) {
            alert('没有有效的作品可下载');
            return;
        }

        // 显示下载选项
        this.showBatchDownloadOptions(selectedWorks);
    }

    /**
     * 显示批量下载选项
     */
    showBatchDownloadOptions(works) {
        const resultDiv = document.getElementById('account-result');
        if (!resultDiv) return;

        const optionsHtml = `
            <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 class="font-semibold text-blue-800 mb-3">
                    <i class="fas fa-download mr-2"></i>批量下载选项
                </h5>
                <div class="mb-3">
                    <p class="text-sm text-blue-700 mb-2">将下载 ${works.length} 个作品</p>
                    <div class="flex gap-3">
                        <button onclick="accountComponent.batchDownloadToServer()" 
                                class="btn btn-success flex-1">
                            <i class="fas fa-server mr-2"></i>批量下载到服务器
                        </button>
                        <button onclick="accountComponent.batchDownloadToBrowser()" 
                                class="btn btn-primary flex-1">
                            <i class="fas fa-download mr-2"></i>批量浏览器下载
                        </button>
                    </div>
                </div>
                <p class="text-xs text-blue-600">
                    <i class="fas fa-info-circle mr-1"></i>
                    批量下载会逐个处理每个作品，请耐心等待完成
                </p>
            </div>
        `;

        resultDiv.insertAdjacentHTML('beforeend', optionsHtml);
    }

    /**
     * 批量下载到服务器
     */
    async batchDownloadToServer() {
        if (!this.currentAccountData || this.selectedWorks.size === 0) return;

        const works = Array.isArray(this.currentAccountData) ? this.currentAccountData : 
                     (this.currentAccountData.aweme_list || this.currentAccountData.itemList || []);
        const selectedWorks = Array.from(this.selectedWorks).map(index => works[index]).filter(Boolean);

        let successCount = 0;
        let failCount = 0;
        const results = [];

        for (let i = 0; i < selectedWorks.length; i++) {
            const work = selectedWorks[i];
            const progress = Math.round(((i + 1) / selectedWorks.length) * 100);
            
            try {
                // 显示进度
                this.updateBatchProgress(i + 1, selectedWorks.length, work.desc || `作品 ${i + 1}`);

                // 获取下载链接
                const downloadUrl = this.getWorkDownloadUrl(work);
                if (!downloadUrl) {
                    throw new Error('没有可下载的链接');
                }

                const title = work.desc || work.title || `作品 ${i + 1}`;
                const author = work.author?.nickname || work.nickname || '未知作者';

                // 下载到服务器
                const result = await api.downloadToServer(downloadUrl, this.currentPlatform, title, author);
                
                if (result.success) {
                    successCount++;
                    results.push({ work: title, status: 'success', path: result.file_path });
                    
                    // 记录下载历史
                    await this.recordSingleDownload(work, this.currentPlatform, 'account');
                } else {
                    throw new Error(result.message);
                }

            } catch (error) {
                failCount++;
                results.push({ 
                    work: work.desc || `作品 ${i + 1}`, 
                    status: 'error', 
                    error: error.message 
                });
                console.error(`下载失败 (${i + 1}/${selectedWorks.length}):`, error);
            }

            // 添加延迟避免请求过快
            if (i < selectedWorks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        // 显示完成结果
        this.showBatchResults(successCount, failCount, results);
    }

    /**
     * 批量浏览器下载
     */
    async batchDownloadToBrowser() {
        if (!this.currentAccountData || this.selectedWorks.size === 0) return;

        const works = Array.isArray(this.currentAccountData) ? this.currentAccountData : 
                     (this.currentAccountData.aweme_list || this.currentAccountData.itemList || []);
        const selectedWorks = Array.from(this.selectedWorks).map(index => works[index]).filter(Boolean);

        let downloadCount = 0;

        selectedWorks.forEach((work, index) => {
            const downloadUrl = this.getWorkDownloadUrl(work);
            if (downloadUrl) {
                setTimeout(() => {
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = `${work.desc || `作品${index + 1}`}`;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }, index * 500); // 每500ms下载一个，避免浏览器阻止

                downloadCount++;

                // 记录下载历史
                this.recordSingleDownload(work, this.currentPlatform, 'account');
            }
        });

        alert(`✅ 开始批量浏览器下载！\n\n📥 共 ${downloadCount} 个作品\n💾 文件将保存到浏览器默认下载文件夹\n\n⏱️ 下载间隔0.5秒，请耐心等待`);
    }

    /**
     * 获取作品下载链接
     */
    getWorkDownloadUrl(work) {
        // 尝试不同的字段获取下载链接
        return work.video?.playAddr || 
               work.video?.downloadAddr || 
               work.downloads ||
               work.video?.play_url ||
               work.play_url ||
               null;
    }

    /**
     * 更新批量下载进度
     */
    updateBatchProgress(current, total, currentWork) {
        const progress = Math.round((current / total) * 100);
        
        // 查找或创建进度显示元素
        let progressDiv = document.getElementById('batch-progress');
        if (!progressDiv) {
            const resultDiv = document.getElementById('account-result');
            if (resultDiv) {
                progressDiv = document.createElement('div');
                progressDiv.id = 'batch-progress';
                progressDiv.className = 'mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg';
                resultDiv.appendChild(progressDiv);
            }
        }

        if (progressDiv) {
            progressDiv.innerHTML = `
                <div class="text-yellow-800">
                    <h5 class="font-semibold mb-2">
                        <i class="fas fa-spinner fa-spin mr-2"></i>批量下载进行中...
                    </h5>
                    <div class="mb-2">
                        <div class="progress-bar">
                            <div class="progress-fill bg-yellow-500" style="width: ${progress}%"></div>
                        </div>
                    </div>
                    <div class="text-sm">
                        进度: ${current}/${total} (${progress}%)<br>
                        当前: ${currentWork}
                    </div>
                </div>
            `;
        }
    }

    /**
     * 显示批量下载结果
     */
    showBatchResults(successCount, failCount, results) {
        const progressDiv = document.getElementById('batch-progress');
        if (progressDiv) {
            progressDiv.innerHTML = `
                <div class="text-green-800">
                    <h5 class="font-semibold mb-3">
                        <i class="fas fa-check-circle mr-2"></i>批量下载完成
                    </h5>
                    <div class="grid grid-cols-2 gap-4 mb-3 text-sm">
                        <div class="text-green-600">
                            <i class="fas fa-check mr-1"></i>成功: ${successCount} 个
                        </div>
                        <div class="text-red-600">
                            <i class="fas fa-times mr-1"></i>失败: ${failCount} 个
                        </div>
                    </div>
                    ${failCount > 0 ? `
                        <details class="text-xs">
                            <summary class="cursor-pointer text-gray-600 mb-2">查看详细结果</summary>
                            <div class="bg-white rounded p-2 border border-gray-200 max-h-32 overflow-y-auto">
                                ${results.map(r => `
                                    <div class="flex justify-between items-center py-1">
                                        <span class="truncate">${r.work}</span>
                                        <span class="${r.status === 'success' ? 'text-green-600' : 'text-red-600'}">
                                            ${r.status === 'success' ? '✓' : '✗'}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </details>
                    ` : ''}
                </div>
            `;
        }
    }

    /**
     * 记录单个下载历史
     */
    async recordSingleDownload(workData, platform, downloadType) {
        try {
            const downloadUrl = this.getWorkDownloadUrl(workData);
            const downloadUrls = downloadUrl ? [downloadUrl] : [];

            const recordData = {
                title: workData.desc || workData.title || '未知标题',
                author: workData.author?.nickname || workData.nickname || '未知作者',
                platform: platform,
                download_urls: JSON.stringify(downloadUrls),
                download_type: downloadType,
                work_id: workData.aweme_id || workData.id || Date.now().toString(),
                thumbnail_url: workData.video?.cover || workData.cover || workData.static_cover || '',
                duration: workData.duration || '',
                tags: JSON.stringify(workData.text_extra || workData.challenges || [])
            };

            await api.saveDownloadHistory(recordData);
        } catch (error) {
            console.warn('记录下载历史失败:', error);
        }
    }
}

// 创建全局账号组件实例
window.AccountComponent = AccountComponent;
window.accountComponent = new AccountComponent();
