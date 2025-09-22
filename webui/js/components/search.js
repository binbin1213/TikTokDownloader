/**
 * 搜索功能组件
 */
class SearchComponent {
    constructor() {
        this.currentSearchData = null;
        this.currentPlatform = 'douyin'; // 默认抖音
        this.selectedResults = new Set();
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
        const searchBtn = document.getElementById('start-search');
        const keywordInput = document.getElementById('search-keyword');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.startSearch());
        }

        if (keywordInput) {
            keywordInput.addEventListener('input', () => this.validateInput());
            keywordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.startSearch();
                }
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
                const cookieInput = document.getElementById('search-cookie');
                if (cookieInput && !cookieInput.value && settings.douyin_cookie) {
                    cookieInput.value = settings.douyin_cookie;
                    this.showCookieHint('已自动加载抖音全局Cookie');
                }
            }
        } catch (error) {
            console.warn('加载全局Cookie失败:', error);
        }
    }

    /**
     * 显示Cookie提示
     */
    showCookieHint(message) {
        const existingHint = document.querySelector('.cookie-hint');
        if (existingHint) existingHint.remove();

        const cookieInput = document.getElementById('search-cookie');
        if (!cookieInput) return;

        const hint = document.createElement('div');
        hint.className = 'cookie-hint text-sm text-green-600 mt-1';
        hint.innerHTML = `<i class="fas fa-check-circle mr-1"></i>${message}`;
        
        cookieInput.parentNode.appendChild(hint);
        
        setTimeout(() => hint.remove(), 3000);
    }

    /**
     * 验证输入
     */
    validateInput() {
        const keyword = document.getElementById('search-keyword')?.value.trim();
        const searchBtn = document.getElementById('start-search');
        
        if (searchBtn) {
            searchBtn.disabled = !keyword;
        }
    }

    /**
     * 开始搜索
     */
    async startSearch() {
        const keyword = document.getElementById('search-keyword')?.value.trim();
        const cookie = document.getElementById('search-cookie')?.value.trim() || '';
        const searchBtn = document.getElementById('start-search');
        const resultDiv = document.getElementById('search-result');

        if (!keyword) {
            alert('请输入搜索关键词');
            return;
        }

        try {
            // 更新按钮状态
            if (searchBtn) {
                searchBtn.disabled = true;
                searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>搜索中...';
            }

            // 获取全局Cookie（如果用户没有手动输入）
            let finalCookie = cookie;
            if (!finalCookie) {
                finalCookie = await this.getGlobalCookie(this.currentPlatform);
            }

            // 调用API搜索
            const result = await api.searchWorks(this.currentPlatform, keyword, finalCookie);

            if (result.message === '获取数据成功！' && result.data) {
                this.currentSearchData = result.data;
                this.displaySearchResults(result.data, keyword);
            } else {
                throw new Error(result.message || '搜索失败');
            }

        } catch (error) {
            console.error('搜索失败:', error);
            
            if (resultDiv) {
                resultDiv.innerHTML = `
                    <div class="card border-red-200 bg-red-50">
                        <div class="text-red-800">
                            <h3 class="font-semibold mb-2">
                                <i class="fas fa-exclamation-triangle mr-2"></i>搜索失败
                            </h3>
                            <p class="text-sm mb-3">${error.message}</p>
                            ${!cookie ? `
                                <div class="bg-red-100 border border-red-200 rounded p-3 text-xs">
                                    <strong>💡 建议:</strong> 尝试添加Cookie以获取更多搜索结果
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
                resultDiv.classList.remove('hidden');
            }

        } finally {
            // 恢复按钮状态
            if (searchBtn) {
                searchBtn.disabled = false;
                searchBtn.innerHTML = '开始搜索';
            }
        }
    }

    /**
     * 获取全局Cookie
     */
    async getGlobalCookie(platform) {
        try {
            const settings = await api.getCookieSettings();
            if (settings.success) {
                return platform === 'douyin' ? settings.douyin_cookie : settings.tiktok_cookie;
            }
        } catch (error) {
            console.warn('获取全局Cookie失败:', error);
        }
        return '';
    }

    /**
     * 显示搜索结果
     */
    displaySearchResults(data, keyword) {
        const resultDiv = document.getElementById('search-result');
        if (!resultDiv) return;

        // 处理搜索结果数据
        const results = this.parseSearchResults(data);
        
        if (!results || results.length === 0) {
            resultDiv.innerHTML = `
                <div class="card border-yellow-200 bg-yellow-50">
                    <div class="text-yellow-800">
                        <h3 class="font-semibold mb-2">
                            <i class="fas fa-search mr-2"></i>没有找到相关内容
                        </h3>
                        <p class="text-sm">关键词 "${keyword}" 没有搜索到相关作品，请尝试其他关键词</p>
                    </div>
                </div>
            `;
            resultDiv.classList.remove('hidden');
            return;
        }

        const platformIcon = this.currentPlatform === 'douyin' ? '🎵' : '🎬';
        const platformName = this.currentPlatform === 'douyin' ? '抖音' : 'TikTok';

        let html = `
            <div class="card border-green-200 bg-green-50">
                <div class="text-green-800">
                    <h3 class="font-semibold mb-4">
                        <i class="fas fa-check-circle mr-2"></i>搜索到 ${results.length} 个相关作品
                    </h3>
                    
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex items-center gap-4">
                            <span class="text-sm">关键词: <strong>${keyword}</strong></span>
                            <span class="text-sm">平台: ${platformIcon} ${platformName}</span>
                        </div>
                        <div class="flex gap-2">
                            <button onclick="searchComponent.selectAll()" class="btn btn-sm btn-secondary">
                                <i class="fas fa-check-square mr-1"></i>全选
                            </button>
                            <button onclick="searchComponent.selectNone()" class="btn btn-sm btn-secondary">
                                <i class="fas fa-square mr-1"></i>全不选
                            </button>
                            <button id="batch-download-btn" onclick="searchComponent.batchDownload()" 
                                    class="btn btn-sm btn-success" disabled>
                                <i class="fas fa-download mr-1"></i>批量下载
                            </button>
                        </div>
                    </div>
                    
                    <div class="text-sm mb-4">
                        已选择: <span id="selected-search-count">0</span> / ${results.length}
                    </div>
                    
                    <div class="max-h-96 overflow-y-auto space-y-3">
        `;

        results.forEach((item, index) => {
            const title = item.desc || item.title || `作品 ${index + 1}`;
            const author = item.author?.nickname || item.nickname || '未知作者';
            const duration = item.duration || '未知';
            const cover = item.video?.cover || item.cover || item.static_cover || item.dynamic_cover || '';
            const stats = item.statistics || item;
            
            html += `
                <div class="search-item bg-white border border-gray-200 rounded-lg p-3">
                    <div class="flex items-start">
                        <div class="flex-shrink-0 mr-3">
                            <input type="checkbox" 
                                   id="search-${index}" 
                                   data-index="${index}"
                                   onchange="searchComponent.toggleResult(${index})"
                                   class="search-checkbox">
                        </div>
                        
                        ${cover ? `
                            <div class="flex-shrink-0 mr-3">
                                <img src="${cover}" alt="封面" 
                                     class="w-20 h-20 object-cover rounded border border-gray-200">
                            </div>
                        ` : ''}
                        
                        <div class="flex-1">
                            <h5 class="font-medium text-gray-900 mb-2">${title}</h5>
                            <div class="text-sm text-gray-600 space-y-1">
                                <div><i class="fas fa-user mr-2"></i>${author}</div>
                                <div><i class="fas fa-clock mr-2"></i>时长: ${duration}</div>
                                <div class="flex gap-4 text-xs mt-2">
                                    <span class="text-red-500">
                                        <i class="fas fa-thumbs-up mr-1"></i>${stats.digg_count || stats.diggCount || 0}
                                    </span>
                                    <span class="text-blue-500">
                                        <i class="fas fa-comment mr-1"></i>${stats.comment_count || stats.commentCount || 0}
                                    </span>
                                    <span class="text-green-500">
                                        <i class="fas fa-share mr-1"></i>${stats.share_count || stats.shareCount || 0}
                                    </span>
                                    <span class="text-purple-500">
                                        <i class="fas fa-eye mr-1"></i>${stats.play_count || stats.playCount || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="flex-shrink-0 ml-3">
                            <button onclick="searchComponent.downloadSingle(${index})" 
                                    class="btn btn-sm btn-primary">
                                <i class="fas fa-download mr-1"></i>下载
                            </button>
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
        
        this.selectedResults.clear();
        this.updateSelectedCount();
    }

    /**
     * 解析搜索结果数据
     */
    parseSearchResults(data) {
        // 根据不同的API返回格式解析数据
        if (Array.isArray(data)) {
            return data;
        }
        
        // 抖音搜索结果格式
        if (data.aweme_list) {
            return data.aweme_list;
        }
        
        // TikTok搜索结果格式
        if (data.itemList) {
            return data.itemList;
        }
        
        // 其他可能的格式
        if (data.data && Array.isArray(data.data)) {
            return data.data;
        }
        
        return [];
    }

    /**
     * 切换结果选择状态
     */
    toggleResult(index) {
        const checkbox = document.getElementById(`search-${index}`);
        if (!checkbox) return;

        if (checkbox.checked) {
            this.selectedResults.add(index);
        } else {
            this.selectedResults.delete(index);
        }

        this.updateSelectedCount();
        this.updateBatchButton();
    }

    /**
     * 全选
     */
    selectAll() {
        document.querySelectorAll('.search-checkbox').forEach((checkbox) => {
            checkbox.checked = true;
            this.selectedResults.add(parseInt(checkbox.dataset.index));
        });
        this.updateSelectedCount();
        this.updateBatchButton();
    }

    /**
     * 全不选
     */
    selectNone() {
        document.querySelectorAll('.search-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.selectedResults.clear();
        this.updateSelectedCount();
        this.updateBatchButton();
    }

    /**
     * 更新选中数量显示
     */
    updateSelectedCount() {
        const countElement = document.getElementById('selected-search-count');
        if (countElement) {
            countElement.textContent = this.selectedResults.size;
        }
    }

    /**
     * 更新批量下载按钮状态
     */
    updateBatchButton() {
        const batchBtn = document.getElementById('batch-download-btn');
        if (batchBtn) {
            batchBtn.disabled = this.selectedResults.size === 0;
        }
    }

    /**
     * 下载单个作品
     */
    async downloadSingle(index) {
        if (!this.currentSearchData) return;

        const results = this.parseSearchResults(this.currentSearchData);
        const item = results[index];
        
        if (!item) {
            alert('作品信息不存在');
            return;
        }

        try {
            // 获取下载链接
            const downloadUrl = this.getItemDownloadUrl(item);
            if (!downloadUrl) {
                alert('没有找到可下载的链接');
                return;
            }

            const title = item.desc || item.title || `搜索结果 ${index + 1}`;
            const author = item.author?.nickname || item.nickname || '未知作者';

            // 显示下载选项
            this.showSingleDownloadOptions(downloadUrl, title, author, item);

        } catch (error) {
            console.error('下载失败:', error);
            alert('下载失败: ' + error.message);
        }
    }

    /**
     * 显示单个下载选项
     */
    showSingleDownloadOptions(downloadUrl, title, author, item) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">下载选项</h3>
                <div class="mb-4">
                    <p class="text-sm text-gray-600 mb-2">标题: ${title}</p>
                    <p class="text-sm text-gray-600">作者: ${author}</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="searchComponent.downloadToServer('${downloadUrl}', '${title}', '${author}', ${JSON.stringify(item).replace(/"/g, '&quot;')}); this.parentElement.parentElement.parentElement.remove()" 
                            class="btn btn-success flex-1">
                        <i class="fas fa-server mr-2"></i>下载到服务器
                    </button>
                    <button onclick="searchComponent.downloadToBrowser('${downloadUrl}', '${title}'); this.parentElement.parentElement.parentElement.remove()" 
                            class="btn btn-primary flex-1">
                        <i class="fas fa-download mr-2"></i>浏览器下载
                    </button>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="btn btn-secondary w-full mt-3">
                    取消
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * 批量下载
     */
    async batchDownload() {
        if (!this.currentSearchData || this.selectedResults.size === 0) {
            alert('请先选择要下载的作品');
            return;
        }

        const results = this.parseSearchResults(this.currentSearchData);
        const selectedItems = Array.from(this.selectedResults).map(index => results[index]).filter(Boolean);

        if (selectedItems.length === 0) {
            alert('没有有效的作品可下载');
            return;
        }

        // 显示批量下载选项
        this.showBatchDownloadOptions(selectedItems);
    }

    /**
     * 显示批量下载选项
     */
    showBatchDownloadOptions(items) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">批量下载选项</h3>
                <div class="mb-4">
                    <p class="text-sm text-gray-600">将下载 ${items.length} 个搜索结果</p>
                </div>
                <div class="flex gap-3">
                    <button onclick="searchComponent.batchDownloadToServer(); this.parentElement.parentElement.parentElement.remove()" 
                            class="btn btn-success flex-1">
                        <i class="fas fa-server mr-2"></i>批量下载到服务器
                    </button>
                    <button onclick="searchComponent.batchDownloadToBrowser(); this.parentElement.parentElement.parentElement.remove()" 
                            class="btn btn-primary flex-1">
                        <i class="fas fa-download mr-2"></i>批量浏览器下载
                    </button>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        class="btn btn-secondary w-full mt-3">
                    取消
                </button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * 获取作品下载链接
     */
    getItemDownloadUrl(item) {
        // 尝试不同的字段获取下载链接
        return item.video?.playAddr || 
               item.video?.downloadAddr || 
               item.downloads ||
               item.video?.play_url ||
               item.play_url ||
               null;
    }

    /**
     * 下载到服务器
     */
    async downloadToServer(downloadUrl, title, author, item) {
        try {
            const result = await api.downloadToServer(downloadUrl, this.currentPlatform, title, author);
            
            if (result.success) {
                alert(`✅ 开始下载到服务器！\n\n📁 保存路径: ${result.file_path}`);
                
                // 记录下载历史
                await this.recordDownload(item, this.currentPlatform, 'search');
            } else {
                alert(`❌ 下载失败！\n\n错误信息: ${result.message}`);
            }
        } catch (error) {
            alert('下载失败: ' + error.message);
        }
    }

    /**
     * 浏览器下载
     */
    downloadToBrowser(downloadUrl, title) {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = title;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert('✅ 开始浏览器下载！');
    }

    /**
     * 批量下载到服务器
     */
    async batchDownloadToServer() {
        const results = this.parseSearchResults(this.currentSearchData);
        const selectedItems = Array.from(this.selectedResults).map(index => results[index]).filter(Boolean);

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < selectedItems.length; i++) {
            const item = selectedItems[i];
            
            try {
                const downloadUrl = this.getItemDownloadUrl(item);
                if (!downloadUrl) {
                    throw new Error('没有可下载的链接');
                }

                const title = item.desc || item.title || `搜索结果 ${i + 1}`;
                const author = item.author?.nickname || item.nickname || '未知作者';

                const result = await api.downloadToServer(downloadUrl, this.currentPlatform, title, author);
                
                if (result.success) {
                    successCount++;
                    await this.recordDownload(item, this.currentPlatform, 'search');
                } else {
                    throw new Error(result.message);
                }

            } catch (error) {
                failCount++;
                console.error(`批量下载失败 (${i + 1}/${selectedItems.length}):`, error);
            }

            // 添加延迟避免请求过快
            if (i < selectedItems.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        alert(`✅ 批量下载完成！\n\n成功: ${successCount} 个\n失败: ${failCount} 个`);
    }

    /**
     * 批量浏览器下载
     */
    batchDownloadToBrowser() {
        const results = this.parseSearchResults(this.currentSearchData);
        const selectedItems = Array.from(this.selectedResults).map(index => results[index]).filter(Boolean);

        let downloadCount = 0;

        selectedItems.forEach((item, index) => {
            const downloadUrl = this.getItemDownloadUrl(item);
            if (downloadUrl) {
                setTimeout(() => {
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = item.desc || `搜索结果${index + 1}`;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }, index * 500);

                downloadCount++;
                this.recordDownload(item, this.currentPlatform, 'search');
            }
        });

        alert(`✅ 开始批量浏览器下载！\n\n📥 共 ${downloadCount} 个作品`);
    }

    /**
     * 记录下载历史
     */
    async recordDownload(workData, platform, downloadType) {
        try {
            const downloadUrl = this.getItemDownloadUrl(workData);
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
                tags: JSON.stringify([])
            };

            await api.saveDownloadHistory(recordData);
        } catch (error) {
            console.warn('记录下载历史失败:', error);
        }
    }
}

// 创建全局搜索组件实例
window.SearchComponent = SearchComponent;
window.searchComponent = new SearchComponent();
