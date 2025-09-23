/**
 * 文件管理组件
 */
class FileManagerComponent {
    constructor() {
        this.currentTab = 'downloads';
        this.downloadHistory = [];
        this.recordingTasks = [];
        this.eventsBound = false;
    }

    /**
     * 初始化组件
     */
    init() {
        // 每次初始化时重置事件绑定标志
        this.eventsBound = false;
        this.bindEvents();
        this.loadData();
        this.updateStats();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        // 防止重复绑定
        if (this.eventsBound) {
            return;
        }
        
        // 选项卡切换 - 直接绑定到现有按钮
        const tabButtons = document.querySelectorAll('.tab-button');
        
        tabButtons.forEach((button) => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const tabName = e.target.dataset.tab || e.target.closest('.tab-button').dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            });
        });
        
        this.eventsBound = true;

        // 刷新按钮
        const refreshDownloads = document.getElementById('refresh-downloads');
        if (refreshDownloads) {
            refreshDownloads.addEventListener('click', () => this.refreshDownloads());
        }

        const refreshRecordings = document.getElementById('refresh-recordings');
        if (refreshRecordings) {
            refreshRecordings.addEventListener('click', () => this.refreshRecordings());
        }

        // 清空历史
        const clearDownloads = document.getElementById('clear-downloads');
        if (clearDownloads) {
            clearDownloads.addEventListener('click', () => this.clearDownloads());
        }

        // 打开文件夹
        const openFolder = document.getElementById('open-folder');
        if (openFolder) {
            openFolder.addEventListener('click', () => this.openDownloadFolder());
        }
    }

    /**
     * 切换选项卡
     */
    switchTab(tabName) {
        // 更新按钮状态
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeButton) {
            activeButton.classList.add('active');
        }

        // 切换内容
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`${tabName}-tab`);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        this.currentTab = tabName;

        // 加载对应数据
        switch (tabName) {
            case 'downloads':
                this.refreshDownloads();
                break;
            case 'recordings':
                this.refreshRecordings();
                break;
            case 'storage':
                this.loadStorageInfo();
                break;
        }
    }

    /**
     * 加载初始数据
     */
    async loadData() {
        await this.refreshDownloads();
        await this.refreshRecordings();
    }

    /**
     * 刷新下载历史
     */
    async refreshDownloads() {
        const listContainer = document.getElementById('downloads-list');
        if (!listContainer) return;

        try {
            // 显示加载状态
            listContainer.innerHTML = '<div class="loading-spinner">加载中...</div>';

            // 从数据库获取历史记录
            const result = await api.getDownloadHistory(50, 0);
            
            if (result.success && result.data) {
                this.downloadHistory = result.data;
                this.renderDownloads();
            } else {
                throw new Error(result.message || '获取下载历史失败');
            }

        } catch (error) {
            console.warn('从数据库获取历史失败，使用本地存储:', error);
            // 失败时从localStorage加载
            this.downloadHistory = JSON.parse(localStorage.getItem('download-history') || '[]');
            this.renderDownloads();
        }

        this.updateStats();
    }

    /**
     * 渲染下载历史
     */
    renderDownloads() {
        const listContainer = document.getElementById('downloads-list');
        if (!listContainer) return;

        if (this.downloadHistory.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-history"></i>
                    </div>
                    <h3 class="empty-title">暂无下载历史</h3>
                    <p class="empty-description">下载作品后会在此显示记录</p>
                    <button onclick="router.navigate('download')" class="btn btn-primary">
                        <i class="fas fa-download mr-2"></i>开始下载
                    </button>
                </div>
            `;
            return;
        }

        let html = '<div class="downloads-grid" style="display: grid; gap: 1rem;">';
        
        this.downloadHistory.forEach((record, index) => {
            const platformIcon = record.platform === 'douyin' ? '🎵' : '🎬';
            const downloadUrls = record.download_urls || record.downloads || [];
            const downloadType = record.download_type || record.downloadType || 'single';
            const downloadTime = record.download_time || record.timestamp || record.date;
            
            // 格式化时间
            let displayTime = '';
            if (downloadTime) {
                try {
                    const date = new Date(downloadTime);
                    displayTime = date.toLocaleString('zh-CN');
                } catch {
                    displayTime = downloadTime;
                }
            }
            
            const downloadCount = Array.isArray(downloadUrls) ? downloadUrls.length : 
                                (typeof downloadUrls === 'string' ? JSON.parse(downloadUrls).length : 0);

            html += `
                <div class="download-item card relative" style="padding: 1rem;">
                    <div class="pr-20">
                        <div class="flex items-center mb-2">
                            <span class="text-2xl mr-3">${platformIcon}</span>
                            <h4 class="font-semibold text-gray-900">${record.title}</h4>
                        </div>
                        <div class="text-sm text-gray-600 space-y-1">
                            <div class="flex items-center">
                                <i class="fas fa-user w-4 text-gray-400 mr-2"></i>
                                <span>${record.author}</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-clock w-4 text-gray-400 mr-2"></i>
                                <span>${displayTime}</span>
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-tag w-4 text-gray-400 mr-2"></i>
                                <span>${this.getDownloadTypeText(downloadType)}</span>
                                ${record.duration ? ` • ${record.duration}` : ''}
                            </div>
                        </div>
                        <div class="mt-3 flex items-center text-xs">
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <i class="fas fa-download mr-1"></i>
                                ${downloadCount} 个文件
                            </span>
                            ${record.status ? `<span class="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">${record.status}</span>` : ''}
                        </div>
                    </div>
                    <div class="absolute bottom-3 right-3 flex gap-1">
                        <button onclick="fileManager.downloadToLocal('${record.id || index}', ${index})" 
                                class="btn btn-success px-2 py-1 text-xs min-w-0" title="下载到本地">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="fileManager.deleteDownload('${record.id || index}', ${index})" 
                                class="btn btn-danger px-2 py-1 text-xs min-w-0" title="删除记录">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        listContainer.innerHTML = html;
    }

    /**
     * 刷新录制任务
     */
    async refreshRecordings() {
        const listContainer = document.getElementById('recordings-list');
        if (!listContainer) return;

        try {
            listContainer.innerHTML = '<div class="loading-spinner">加载中...</div>';
            
            const result = await api.getRecordingStatus();
            this.recordingTasks = result;
            this.renderRecordings();
            
        } catch (error) {
            console.error('获取录制状态失败:', error);
            listContainer.innerHTML = `
                <div class="error-state">
                    <h3>获取录制状态失败</h3>
                    <p>${error.message}</p>
                    <button onclick="fileManager.refreshRecordings()" class="btn btn-primary">重试</button>
                </div>
            `;
        }

        this.updateStats();
    }

    /**
     * 渲染录制任务
     */
    renderRecordings() {
        const listContainer = document.getElementById('recordings-list');
        if (!listContainer) return;

        const hasActiveTasks = this.recordingTasks.recording_tasks && this.recordingTasks.recording_tasks.length > 0;
        const hasCompletedFiles = this.recordingTasks.completed_files && this.recordingTasks.completed_files.length > 0;

        if (!hasActiveTasks && !hasCompletedFiles) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-video"></i>
                    </div>
                    <h3 class="empty-title">暂无录制任务</h3>
                    <p class="empty-description">开始录制直播后会在此显示进度和状态</p>
                    <button onclick="router.navigate('live')" class="btn btn-primary">
                        <i class="fas fa-broadcast-tower mr-2"></i>开始录制直播
                    </button>
                </div>
            `;
            return;
        }

        let html = '';

        // 显示正在录制的任务
        if (hasActiveTasks) {
            html += '<div class="mb-6"><h4 class="font-semibold text-red-700 mb-4">正在录制的任务</h4>';
            html += `
                <div class="overflow-x-auto mb-6">
                    <table class="recording-table">
                        <thead>
                            <tr>
                                <th>平台</th>
                                <th>主播</th>
                                <th>录制模式</th>
                                <th>已录制</th>
                                <th>剩余时间</th>
                                <th>进度</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            this.recordingTasks.recording_tasks.forEach(task => {
                const isSmartRecording = task.is_smart_recording || task.duration === 0;
                const progressWidth = Math.round(task.progress || 0);
                
                html += `
                    <tr class="recording-row ${isSmartRecording ? 'recording-smart' : 'recording-timed'}">
                        <td>
                            <span class="platform-badge platform-${task.platform.toLowerCase()}">
                                <i class="fas fa-tv mr-1"></i>${task.platform.toUpperCase()}
                            </span>
                        </td>
                        <td class="streamer-name">
                            <div class="flex items-center">
                                <div class="w-3 h-3 ${isSmartRecording ? 'bg-green-500' : 'bg-orange-500'} rounded-full animate-pulse mr-2"></div>
                                ${task.streamer_name || '未知主播'}
                            </div>
                        </td>
                        <td>
                            <span class="status-badge ${isSmartRecording ? 'status-smart' : 'status-timed'}">
                                ${isSmartRecording ? '🤖 智能录制' : '⏱️ 定时录制'}
                            </span>
                        </td>
                        <td class="recording-time">
                            <strong>${task.elapsed_minutes || 0}:${(task.elapsed_seconds || 0).toString().padStart(2, '0')}</strong>
                        </td>
                        <td class="recording-time">
                            ${isSmartRecording ? '<span class="text-green-600 font-semibold">∞</span>' : `<strong>${task.remaining_minutes || 0}:${(task.remaining_seconds || 0).toString().padStart(2, '0')}</strong>`}
                        </td>
                        <td>
                            <div class="progress-container">
                                <div class="progress-bar-mini">
                                    <div class="progress-fill-mini ${isSmartRecording ? 'bg-green-500 pulse' : 'bg-orange-500'}" 
                                         style="width: ${isSmartRecording ? '100' : progressWidth}%"></div>
                                </div>
                                <span class="progress-text">${isSmartRecording ? '智能' : progressWidth + '%'}</span>
                            </div>
                        </td>
                        <td>
                            <button onclick="fileManager.stopRecording(${task.pid}, '${task.streamer_name || ''}')" 
                                    class="btn btn-danger btn-sm">
                                <i class="fas fa-stop mr-1"></i>停止
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            </div>`;
        }

        // 显示已完成的录制文件
        if (hasCompletedFiles) {
            html += '<div><h4 class="font-semibold text-green-700 mb-4">已完成录制</h4>';
            html += `
                <div class="overflow-x-auto">
                    <table class="recording-table">
                        <thead>
                            <tr>
                                <th>平台</th>
                                <th>录制时间</th>
                                <th>直播间</th>
                                <th>状态</th>
                                <th>文件大小</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            this.recordingTasks.completed_files.forEach(file => {
                const createdDate = new Date(file.created_time * 1000).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }).replace(/\//g, '/');
                
                // 使用API返回的主播名，如果没有则使用文件名提取
                const streamerName = file.streamer_name || file.filename.replace(/_live_\d+\.mp4$/, '') || '未知主播';
                
                html += `
                    <tr class="recording-row">
                        <td>
                            <span class="platform-badge platform-${file.platform.toLowerCase()}">
                                <i class="fas fa-tv mr-1"></i>${file.platform.toUpperCase()}
                            </span>
                        </td>
                        <td class="recording-time">${createdDate}</td>
                        <td class="streamer-name">${streamerName}</td>
                        <td>
                            <span class="status-badge status-completed">
                                <i class="fas fa-check-circle mr-1"></i>已完成
                            </span>
                        </td>
                        <td class="file-size">${file.size_mb} MB</td>
                        <td>
                            <div class="flex gap-2">
                                <button onclick="api.downloadFromServer('${file.platform}', 'live_records/${file.filename}')" 
                                        class="btn btn-primary btn-sm">
                                    <i class="fas fa-download mr-1"></i>下载
                                </button>
                                <button onclick="fileManagerComponent.deleteRecordingFile('${file.platform}', '${file.filename}')" 
                                        class="btn btn-danger btn-sm">
                                    <i class="fas fa-trash mr-1"></i>删除
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
            </div>`;
        }

        listContainer.innerHTML = html;
    }

    /**
     * 加载存储信息
     */
    loadStorageInfo() {
        const infoContainer = document.getElementById('storage-info');
        if (!infoContainer) return;

        infoContainer.innerHTML = `
            <div class="storage-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem;">
                <div class="card">
                    <h4 class="font-semibold mb-4">
                        <i class="fas fa-server text-blue-500 mr-2"></i>
                        服务器存储路径
                    </h4>
                    <div class="bg-gray-100 rounded p-3 font-mono text-sm mb-3">
                        /Users/binbin/Downloads/TikTokDownloader/Volume/Download/
                    </div>
                    <p class="text-sm text-gray-600">所有通过API下载和录制的文件都保存在此目录</p>
                </div>

                <div class="card">
                    <h4 class="font-semibold mb-4">
                        <i class="fas fa-download text-green-500 mr-2"></i>
                        本地下载路径
                    </h4>
                    <div class="bg-gray-100 rounded p-3 font-mono text-sm mb-3">
                        浏览器默认下载文件夹
                    </div>
                    <p class="text-sm text-gray-600">建议创建专用文件夹便于管理</p>
                </div>

                <div class="card">
                    <h4 class="font-semibold mb-4">
                        <i class="fas fa-folder-plus text-yellow-500 mr-2"></i>
                        文件夹管理
                    </h4>
                    <div class="space-y-2">
                        <button onclick="fileManager.createFolderStructure()" class="btn btn-secondary btn-sm w-full">
                            <i class="fas fa-sitemap mr-2"></i>创建推荐文件夹结构
                        </button>
                        <button onclick="fileManager.openDownloadFolder()" class="btn btn-secondary btn-sm w-full">
                            <i class="fas fa-folder-open mr-2"></i>打开下载文件夹
                        </button>
                    </div>
                </div>

                <div class="card">
                    <h4 class="font-semibold mb-4">
                        <i class="fas fa-chart-pie text-purple-500 mr-2"></i>
                        存储统计
                    </h4>
                    <div class="space-y-2 text-sm">
                        <div class="flex justify-between">
                            <span>总文件数:</span>
                            <span>计算中...</span>
                        </div>
                        <div class="flex justify-between">
                            <span>占用空间:</span>
                            <span>计算中...</span>
                        </div>
                        <div class="flex justify-between">
                            <span>最近更新:</span>
                            <span>计算中...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 更新统计数据
     */
    updateStats() {
        // 更新下载统计
        const totalElement = document.getElementById('total-downloads');
        const videoElement = document.getElementById('video-downloads');
        const todayElement = document.getElementById('today-downloads');
        const recordingElement = document.getElementById('recording-count');

        if (totalElement) {
            totalElement.textContent = this.downloadHistory.length;
        }

        if (videoElement) {
            const videoCount = this.downloadHistory.filter(item => 
                item.type === 'video' || (item.duration && item.duration !== '')
            ).length;
            videoElement.textContent = videoCount;
        }

        if (todayElement) {
            const today = new Date().toDateString();
            const todayCount = this.downloadHistory.filter(item => {
                const itemDate = new Date(item.download_time || item.timestamp || item.date);
                return itemDate.toDateString() === today;
            }).length;
            todayElement.textContent = todayCount;
        }

        if (recordingElement) {
            const activeCount = (this.recordingTasks.recording_tasks && this.recordingTasks.recording_tasks.length) || 0;
            recordingElement.textContent = activeCount;
        }
    }

    /**
     * 获取下载类型文本
     */
    getDownloadTypeText(type) {
        const typeMap = {
            'single': '单个下载',
            'account': '账号下载',
            'search': '搜索下载',
            'batch': '批量下载'
        };
        return typeMap[type] || '单个下载';
    }

    /**
     * 下载到本地（浏览器下载）
     */
    async downloadToLocal(recordId, index) {
        try {
            const record = this.downloadHistory[index];
            if (!record) {
                alert('❌ 找不到下载记录');
                return;
            }

            const downloadUrls = record.download_urls || record.downloads || [];
            let urls = [];
            
            if (Array.isArray(downloadUrls)) {
                urls = downloadUrls;
            } else if (typeof downloadUrls === 'string') {
                try {
                    urls = JSON.parse(downloadUrls);
                } catch {
                    urls = [downloadUrls];
                }
            }

            if (urls.length === 0) {
                alert('❌ 该记录没有可用的下载链接');
                return;
            }

            // 批量下载到浏览器
            urls.forEach((url, urlIndex) => {
                setTimeout(() => {
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `${record.title}_${urlIndex + 1}`;
                    link.style.display = 'none';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }, urlIndex * 500); // 间隔500ms下载，避免浏览器阻止
            });

            alert(`✅ 开始浏览器下载！\n\n📥 共 ${urls.length} 个文件\n💾 文件将保存到浏览器默认下载文件夹\n\n⏱️ 下载间隔0.5秒，请耐心等待`);

        } catch (error) {
            console.error('下载到本地失败:', error);
            alert(`❌ 下载失败！\n\n错误信息: ${error.message}`);
        }
    }

    /**
     * 删除下载记录
     */
    async deleteDownload(recordId, index) {
        if (!confirm('确定要删除这条下载记录吗？此操作不可恢复。')) return;
        
        try {
            // 从数组中删除记录
            if (index >= 0 && index < this.downloadHistory.length) {
                const deletedRecord = this.downloadHistory.splice(index, 1)[0];
                
                // 更新localStorage
                localStorage.setItem('download-history', JSON.stringify(this.downloadHistory));
                
                // 重新渲染
                this.renderDownloads();
                this.updateStats();
                
                // 如果有数据库API，可以在这里调用删除
                // await api.deleteDownloadHistory(recordId);
                
                alert(`✅ 删除成功！\n\n已删除: ${deletedRecord.title}\n\n💡 注意: 仅从本地记录中删除，不影响已下载文件`);
            } else {
                throw new Error('无效的记录索引');
            }
        } catch (error) {
            console.error('删除记录失败:', error);
            alert(`❌ 删除失败！\n\n错误信息: ${error.message}`);
        }
    }

    /**
     * 停止录制
     */
    async stopRecording(pid, streamerName) {
        const confirmMsg = `确定要停止录制任务吗？\n\n📺 主播: ${streamerName || '未知'}\n🆔 进程ID: ${pid}\n\n⚠️ 停止后:\n• 已录制内容将保存\n• 录制立即结束\n• 不影响其他录制任务`;
        
        if (!confirm(confirmMsg)) return;

        try {
            const result = await api.stopRecording(pid, streamerName);
            
            if (result.success) {
                alert(`✅ 录制任务已停止！\n\n🆔 进程ID: ${result.process_id}\n🛑 停止方式: ${result.stop_method}\n📁 输出文件: ${result.output_file ? result.output_file.split('/').pop() : '未知'}\n\n💡 文件已保存，可在文件管理中查看和下载。`);
                this.refreshRecordings();
            } else {
                alert(`❌ 停止录制失败！\n\n错误信息: ${result.message}`);
            }
        } catch (error) {
            alert(`❌ 停止录制失败！\n\n错误信息: ${error.message}`);
        }
    }

    /**
     * 清空下载历史
     */
    async clearDownloads() {
        if (!confirm('确定要清空所有下载历史吗？此操作不可恢复。')) return;
        
        localStorage.removeItem('download-history');
        this.downloadHistory = [];
        this.renderDownloads();
        this.updateStats();
        
        alert('下载历史已清空！');
    }

    /**
     * 打开下载文件夹
     */
    openDownloadFolder() {
        alert('💡 打开文件夹功能\n\n请手动打开以下路径:\n/Users/binbin/Downloads/TikTokDownloader/Volume/Download/\n\n或使用系统文件管理器访问服务器下载目录。');
    }

    /**
     * 创建推荐文件夹结构
     */
    createFolderStructure() {
        const structure = `推荐的文件夹结构：

📁 DouK-Downloader/
├── 📁 抖音/
│   ├── 📁 单个作品/
│   ├── 📁 账号作品/
│   └── 📁 直播录制/
├── 📁 TikTok/
│   ├── 📁 单个作品/
│   ├── 📁 账号作品/
│   └── 📁 直播录制/
└── 📁 搜索结果/

建议：
• 按平台分类存储
• 定期整理文件
• 使用有意义的文件名`;
        
        alert(structure);
    }

    /**
     * 加载存储信息
     */
    async loadStorageInfo() {
        const storageContainer = document.getElementById('storage-info');
        if (!storageContainer) return;

        try {
            storageContainer.innerHTML = '<div class="loading-spinner">加载存储信息中...</div>';

            // 构建存储信息界面
            const storageInfo = await this.getStorageInfo();
            this.renderStorageInfo(storageInfo);

        } catch (error) {
            console.error('加载存储信息失败:', error);
            storageContainer.innerHTML = `
                <div class="error-state">
                    <h3>加载存储信息失败</h3>
                    <p>${error.message}</p>
                    <button onclick="fileManagerComponent.loadStorageInfo()" class="btn btn-primary">重试</button>
                </div>
            `;
        }
    }

    /**
     * 获取存储信息
     */
    async getStorageInfo() {
        try {
            const result = await api.getStorageStats();
            if (result.success && result.data) {
                return {
                    serverPath: result.data.server_path,
                    localPath: '~/Downloads',
                    totalFiles: result.data.total_files,
                    totalSize: result.data.total_size_formatted,
                    videoFiles: result.data.video_files,
                    imageFiles: result.data.image_files,
                    platforms: {
                        douyin: { 
                            files: result.data.platforms.douyin.files, 
                            size: result.data.platforms.douyin.size_formatted,
                            videos: result.data.platforms.douyin.videos,
                            images: result.data.platforms.douyin.images
                        },
                        tiktok: { 
                            files: result.data.platforms.tiktok.files, 
                            size: result.data.platforms.tiktok.size_formatted,
                            videos: result.data.platforms.tiktok.videos,
                            images: result.data.platforms.tiktok.images
                        }
                    },
                    lastUpdate: new Date().toLocaleString()
                };
            } else {
                throw new Error(result.message || '获取存储统计失败');
            }
        } catch (error) {
            console.warn('获取存储统计失败，使用默认数据:', error);
            // 返回默认数据作为后备
            return {
                serverPath: '/Users/binbin/Downloads/TikTokDownloader/Volume/Download',
                localPath: '~/Downloads',
                totalFiles: 0,
                totalSize: '0 B',
                videoFiles: 0,
                imageFiles: 0,
                platforms: {
                    douyin: { files: 0, size: '0 B', videos: 0, images: 0 },
                    tiktok: { files: 0, size: '0 B', videos: 0, images: 0 }
                },
                lastUpdate: new Date().toLocaleString()
            };
        }
    }

    /**
     * 渲染存储信息界面
     */
    renderStorageInfo(info) {
        const storageContainer = document.getElementById('storage-info');
        if (!storageContainer) return;

        const html = `
            <!-- 存储统计总览 -->
            <div class="card mb-6">
                <div class="card-header">
                    <h4 class="text-lg font-semibold text-gray-800">存储统计总览</h4>
                    <p class="text-sm text-gray-500">最后更新: ${info.lastUpdate}</p>
                </div>
                <div class="overflow-x-auto">
                    <table class="recording-table">
                        <thead>
                            <tr>
                                <th>统计项目</th>
                                <th>数量</th>
                                <th>大小</th>
                                <th>占比</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="recording-row">
                                <td>
                                    <span class="platform-badge platform-douyin">
                                        <i class="fas fa-files-o mr-1"></i>总文件
                                    </span>
                                </td>
                                <td class="recording-time"><strong>${info.totalFiles}</strong></td>
                                <td class="recording-time"><strong>${info.totalSize}</strong></td>
                                <td class="recording-time">100%</td>
                            </tr>
                            <tr class="recording-row">
                                <td>
                                    <span class="status-badge status-smart">
                                        <i class="fas fa-video mr-1"></i>视频文件
                                    </span>
                                </td>
                                <td class="recording-time">${info.videoFiles}</td>
                                <td class="recording-time">-</td>
                                <td class="recording-time">${info.totalFiles > 0 ? Math.round((info.videoFiles / info.totalFiles) * 100) : 0}%</td>
                            </tr>
                            <tr class="recording-row">
                                <td>
                                    <span class="status-badge status-timed">
                                        <i class="fas fa-image mr-1"></i>图片文件
                                    </span>
                                </td>
                                <td class="recording-time">${info.imageFiles}</td>
                                <td class="recording-time">-</td>
                                <td class="recording-time">${info.totalFiles > 0 ? Math.round((info.imageFiles / info.totalFiles) * 100) : 0}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 平台分布统计 -->
            <div class="card mb-6">
                <div class="card-header">
                    <h4 class="text-lg font-semibold text-gray-800">平台分布统计</h4>
                </div>
                <div class="overflow-x-auto">
                    <table class="recording-table">
                        <thead>
                            <tr>
                                <th>平台</th>
                                <th>总文件</th>
                                <th>视频</th>
                                <th>图片</th>
                                <th>大小</th>
                                <th>占比</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="recording-row">
                                <td>
                                    <span class="platform-badge platform-douyin">
                                        <i class="fas fa-tv mr-1"></i>抖音
                                    </span>
                                </td>
                                <td class="recording-time"><strong>${info.platforms.douyin.files}</strong></td>
                                <td class="recording-time">${info.platforms.douyin.videos}</td>
                                <td class="recording-time">${info.platforms.douyin.images}</td>
                                <td class="recording-time">${info.platforms.douyin.size}</td>
                                <td class="recording-time">${info.totalFiles > 0 ? Math.round((info.platforms.douyin.files / info.totalFiles) * 100) : 0}%</td>
                            </tr>
                            <tr class="recording-row">
                                <td>
                                    <span class="platform-badge platform-tiktok">
                                        <i class="fas fa-tv mr-1"></i>TikTok
                                    </span>
                                </td>
                                <td class="recording-time"><strong>${info.platforms.tiktok.files}</strong></td>
                                <td class="recording-time">${info.platforms.tiktok.videos}</td>
                                <td class="recording-time">${info.platforms.tiktok.images}</td>
                                <td class="recording-time">${info.platforms.tiktok.size}</td>
                                <td class="recording-time">${info.totalFiles > 0 ? Math.round((info.platforms.tiktok.files / info.totalFiles) * 100) : 0}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        storageContainer.innerHTML = html;
    }

    /**
     * 打开服务器文件夹
     */
    openServerFolder() {
        // 在实际环境中，这个功能可能需要后端API支持
        alert('服务器文件夹路径:\n/Users/binbin/Downloads/TikTokDownloader/Volume/Download\n\n请在Finder中手动打开此路径');
    }

    /**
     * 打开本地文件夹
     */
    openLocalFolder() {
        // 尝试使用本地文件API或提供指导
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Mac')) {
            alert('建议在Finder中打开 ~/Downloads 文件夹');
        } else if (userAgent.includes('Windows')) {
            alert('建议在资源管理器中打开 %USERPROFILE%\\Downloads 文件夹');
        } else {
            alert('建议在文件管理器中打开用户的Downloads文件夹');
        }
    }

    /**
     * 清理临时文件
     */
    async cleanupFiles() {
        if (!confirm('确定要清理临时文件吗？这将删除缓存和临时下载文件。')) {
            return;
        }

        try {
            // 这里应该调用API来清理文件
            alert('清理功能需要后端API支持，请手动清理临时文件');
        } catch (error) {
            alert('清理失败: ' + error.message);
        }
    }

    /**
     * 删除录制文件
     */
    async deleteRecordingFile(platform, filename) {
        if (!confirm(`确定要删除文件 "${filename}" 吗？\n\n⚠️ 警告：此操作将同时删除服务器上的文件，无法恢复！`)) {
            return;
        }

        try {
            // 显示加载状态
            const button = event.target.closest('button');
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>删除中...';
            button.disabled = true;

            // 调用API删除文件
            const result = await api.deleteRecordingFile(platform, filename);
            
            if (result.success) {
                alert(`✅ 删除成功！\n\n已删除文件：\n${result.deleted_files.join('\n')}`);
                
                // 刷新录制状态列表
                await this.refreshRecordings();
            } else {
                throw new Error(result.error || '删除失败');
            }

        } catch (error) {
            console.error('删除文件失败:', error);
            alert(`❌ 删除失败：${error.message}`);
            
            // 恢复按钮状态
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
        }
    }
}

// 创建全局文件管理组件实例
window.FileManagerComponent = FileManagerComponent;
window.fileManagerComponent = new FileManagerComponent();
