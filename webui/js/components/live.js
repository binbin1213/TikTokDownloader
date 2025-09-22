/**
 * 直播下载组件
 */
class LiveComponent {
    constructor() {
        this.currentLiveData = null;
        this.currentPlatform = null;
        this.currentStreamUrl = null;
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
        const getInfoBtn = document.getElementById('get-live-info');
        const liveUrlInput = document.getElementById('live-url');

        if (getInfoBtn) {
            getInfoBtn.addEventListener('click', () => this.getLiveInfo());
        }

        if (liveUrlInput) {
            liveUrlInput.addEventListener('input', () => this.validateInput());
            liveUrlInput.addEventListener('paste', () => {
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
        const liveUrl = document.getElementById('live-url')?.value.trim();
        const getInfoBtn = document.getElementById('get-live-info');
        
        if (getInfoBtn) {
            getInfoBtn.disabled = !liveUrl;
        }

        // 如果URL改变，尝试加载对应平台的Cookie
        if (liveUrl) {
            this.tryLoadPlatformCookie(liveUrl);
        }
    }

    /**
     * 尝试加载平台对应的Cookie
     */
    async tryLoadPlatformCookie(url) {
        const platform = this.detectPlatform(url);
        const cookieInput = document.getElementById('live-cookie');
        
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

        const cookieInput = document.getElementById('live-cookie');
        if (!cookieInput) return;

        const hint = document.createElement('div');
        hint.className = 'cookie-hint text-sm text-green-600 mt-1';
        hint.innerHTML = `<i class="fas fa-check-circle mr-1"></i>${message}`;
        
        cookieInput.parentNode.appendChild(hint);
        
        setTimeout(() => hint.remove(), 3000);
    }

    /**
     * 从URL中提取直播间ID
     */
    extractIdFromUrl() {
        const liveUrlInput = document.getElementById('live-url');
        if (!liveUrlInput) return;

        const url = liveUrlInput.value.trim();
        if (!url) return;

        // 抖音直播间链接模式
        const douyinPatterns = [
            /live\.douyin\.com\/(\d+)/,
            /webcast\.amemv\.com.*?room_id[=\/](\d+)/,
            /(\d+)/ // 纯数字
        ];

        // TikTok直播间链接模式
        const tiktokPatterns = [
            /tiktok\.com\/.*?live.*?(\d+)/,
            /live\.tiktok\.com\/(\d+)/,
            /(\d+)/ // 纯数字
        ];

        // 判断平台并提取ID
        if (url.includes('douyin.com') || url.includes('amemv.com')) {
            for (const pattern of douyinPatterns) {
                const match = url.match(pattern);
                if (match) {
                    liveUrlInput.value = match[1];
                    this.showPlatformHint('douyin');
                    break;
                }
            }
        } else if (url.includes('tiktok.com')) {
            for (const pattern of tiktokPatterns) {
                const match = url.match(pattern);
                if (match) {
                    liveUrlInput.value = match[1];
                    this.showPlatformHint('tiktok');
                    break;
                }
            }
        } else if (/^\d+$/.test(url)) {
            // 纯数字，默认为抖音（可根据需要调整）
            this.showPlatformHint('douyin');
        }

        this.validateInput();
    }

    /**
     * 显示平台提示
     */
    showPlatformHint(platform) {
        const existingHint = document.querySelector('.platform-hint');
        if (existingHint) existingHint.remove();

        const liveUrlInput = document.getElementById('live-url');
        if (!liveUrlInput) return;

        const hint = document.createElement('div');
        hint.className = 'platform-hint text-sm text-blue-600 mt-1';
        hint.innerHTML = `<i class="fas fa-info-circle mr-1"></i>检测到${platform === 'douyin' ? '抖音' : 'TikTok'}平台`;
        
        liveUrlInput.parentNode.appendChild(hint);
        
        setTimeout(() => hint.remove(), 3000);
    }

    /**
     * 检测平台
     */
    detectPlatform(input) {
        if (input.includes('douyin.com') || input.includes('amemv.com')) {
            return 'douyin';
        } else if (input.includes('tiktok.com')) {
            return 'tiktok';
        }
        
        // 纯数字默认为抖音
        if (/^\d+$/.test(input)) {
            return 'douyin';
        }
        
        return null;
    }

    /**
     * 获取直播信息
     */
    async getLiveInfo() {
        const liveUrl = document.getElementById('live-url')?.value.trim();
        const cookie = document.getElementById('live-cookie')?.value.trim() || '';
        const getInfoBtn = document.getElementById('get-live-info');
        const resultDiv = document.getElementById('live-result');

        if (!liveUrl) {
            alert('请输入直播间链接或ID');
            return;
        }

        // 确定平台
        const platform = this.detectPlatform(liveUrl);
        if (!platform) {
            alert('无法识别平台，请确认输入的是抖音或TikTok直播间链接/ID');
            return;
        }

        this.currentPlatform = platform;

        // 提取直播间ID
        const liveId = this.extractLiveId(liveUrl);
        if (!liveId) {
            alert('无法提取直播间ID，请确认输入格式正确');
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

            // 调用API获取直播信息
            const result = await api.getLiveInfo(platform, liveId, finalCookie);

            if (result.message === '获取数据成功！' && result.data) {
                this.currentLiveData = result.data;
                this.displayLiveInfo(result.data, platform);
            } else {
                throw new Error(result.message || '获取直播信息失败');
            }

        } catch (error) {
            console.error('获取直播信息失败:', error);
            
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
                                • 直播已结束或未开始<br>
                                • 直播间ID不正确<br>
                                • 需要Cookie访问<br>
                                • 网络连接问题
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
                getInfoBtn.innerHTML = '获取直播信息';
            }
        }
    }

    /**
     * 提取直播间ID
     */
    extractLiveId(input) {
        // 如果是完整URL，提取ID
        const patterns = [
            /live\.douyin\.com\/(\d+)/,
            /webcast\.amemv\.com.*?room_id[=\/](\d+)/,
            /tiktok\.com\/.*?live.*?(\d+)/,
            /live\.tiktok\.com\/(\d+)/,
            /(\d+)/ // 纯数字
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match) {
                return match[1];
            }
        }

        return input; // 如果都不匹配，返回原输入
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
     * 显示直播信息
     */
    displayLiveInfo(data, platform) {
        const resultDiv = document.getElementById('live-result');
        if (!resultDiv) return;

        const platformIcon = platform === 'douyin' ? '🎵' : '🎬';
        const platformName = platform === 'douyin' ? '抖音' : 'TikTok';
        
        // 查找直播流地址
        const streamUrl = this.findStreamUrl(data);
        this.currentStreamUrl = streamUrl;

        const html = `
            <div class="card border-green-200 bg-green-50">
                <div class="text-green-800">
                    <h3 class="font-semibold mb-4">
                        <i class="fas fa-check-circle mr-2"></i>直播信息获取成功
                    </h3>
                    
                    <div class="bg-white rounded-lg p-4 mb-4 border border-green-200">
                        <div class="flex items-start mb-3">
                            <span class="text-3xl mr-4">${platformIcon}</span>
                            <div class="flex-1">
                                <h4 class="font-semibold text-gray-900 mb-2">${data.title || data.room_title || '直播间'}</h4>
                                <div class="text-sm text-gray-600 space-y-1">
                                    <div><i class="fas fa-user mr-2"></i>主播: ${data.owner?.nickname || data.nickname || data.anchor_name || '未知主播'}</div>
                                    <div><i class="fas fa-users mr-2"></i>观看人数: ${data.user_count || data.total_user || '未知'}</div>
                                    <div><i class="fas fa-broadcast-tower mr-2"></i>状态: ${data.status === 2 || data.live_status === 1 ? '🔴 直播中' : '⚪ 未直播'}</div>
                                    <div><i class="fas fa-tag mr-2"></i>平台: ${platformName}</div>
                                </div>
                            </div>
                        </div>
                        
                        ${data.cover || data.room_cover ? `
                            <div class="mb-3">
                                <img src="${data.cover || data.room_cover}" 
                                     alt="直播间封面" 
                                     class="w-48 h-32 object-cover rounded-lg border border-gray-200">
                            </div>
                        ` : ''}
                    </div>
                    
                    ${streamUrl ? this.renderStreamOptions(streamUrl, data) : this.renderNoStreamMessage()}
                </div>
            </div>
        `;

        resultDiv.innerHTML = html;
        resultDiv.classList.remove('hidden');
    }

    /**
     * 查找直播流地址
     */
    findStreamUrl(data) {
        // 尝试不同的字段获取流地址
        const possibleUrls = [
            data.live_pull_url,
            data.stream_url,
            data.flv_pull_url?.FULL_HD1,
            data.hls_pull_url_map?.FULL_HD1,
            data.pull_url?.flv_pull_url?.FULL_HD1,
            data.pull_url?.hls_pull_url?.FULL_HD1
        ];

        // 如果上述都没有，尝试从对象中查找URL
        if (!possibleUrls.some(Boolean)) {
            if (data.flv_pull_url && typeof data.flv_pull_url === 'object') {
                const flvUrls = Object.values(data.flv_pull_url);
                if (flvUrls.length > 0) return flvUrls[0];
            }
            
            if (data.hls_pull_url_map && typeof data.hls_pull_url_map === 'object') {
                const hlsUrls = Object.values(data.hls_pull_url_map);
                if (hlsUrls.length > 0) return hlsUrls[0];
            }
        }

        return possibleUrls.find(Boolean) || null;
    }

    /**
     * 渲染流选项
     */
    renderStreamOptions(streamUrl, data) {
        const streamerName = data.owner?.nickname || data.nickname || data.anchor_name || '未知主播';
        
        return `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 class="font-semibold text-blue-800 mb-3">
                    <i class="fas fa-broadcast-tower mr-2"></i>直播流操作
                </h5>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <button onclick="liveComponent.copyStreamUrl()" 
                            class="btn btn-secondary">
                        <i class="fas fa-copy mr-2"></i>复制流地址
                    </button>
                    <button onclick="liveComponent.downloadM3U8()" 
                            class="btn btn-secondary">
                        <i class="fas fa-download mr-2"></i>下载M3U8
                    </button>
                    <button onclick="liveComponent.openInVLC()" 
                            class="btn btn-secondary">
                        <i class="fas fa-play mr-2"></i>VLC播放
                    </button>
                    <button onclick="liveComponent.showRecordOptions()" 
                            class="btn btn-primary">
                        <i class="fas fa-record-vinyl mr-2"></i>录制到服务器
                    </button>
                </div>
                
                <div class="text-xs text-blue-600">
                    <i class="fas fa-info-circle mr-1"></i>
                    流地址: ${streamUrl.substring(0, 60)}...
                </div>
            </div>
        `;
    }

    /**
     * 渲染无流消息
     */
    renderNoStreamMessage() {
        return `
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div class="text-yellow-800">
                    <h5 class="font-semibold mb-2">
                        <i class="fas fa-exclamation-triangle mr-2"></i>未找到直播流地址
                    </h5>
                    <p class="text-sm mb-3">可能的原因：</p>
                    <ul class="text-sm list-disc list-inside space-y-1">
                        <li>直播已结束或尚未开始</li>
                        <li>需要更高权限的Cookie</li>
                        <li>直播间设置了访问限制</li>
                    </ul>
                </div>
            </div>
        `;
    }

    /**
     * 复制流地址
     */
    async copyStreamUrl() {
        if (!this.currentStreamUrl) {
            alert('没有可用的流地址');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.currentStreamUrl);
            alert('✅ 流地址已复制到剪贴板！');
        } catch (error) {
            // 降级方案
            const textArea = document.createElement('textarea');
            textArea.value = this.currentStreamUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('✅ 流地址已复制到剪贴板！');
        }
    }

    /**
     * 下载M3U8
     */
    downloadM3U8() {
        if (!this.currentStreamUrl) {
            alert('没有可用的流地址');
            return;
        }

        const streamerName = this.currentLiveData?.owner?.nickname || 
                           this.currentLiveData?.nickname || 
                           this.currentLiveData?.anchor_name || '未知主播';
        
        const m3u8Content = `#EXTM3U
#EXT-X-VERSION:3
#EXTINF:-1,${streamerName} - 直播
${this.currentStreamUrl}`;

        const blob = new Blob([m3u8Content], { type: 'application/vnd.apple.mpegurl' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${streamerName}_live.m3u8`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert('✅ M3U8文件已下载！\n\n💡 可以使用VLC等播放器打开观看直播');
    }

    /**
     * VLC播放
     */
    openInVLC() {
        if (!this.currentStreamUrl) {
            alert('没有可用的流地址');
            return;
        }

        // 尝试打开VLC协议
        const vlcUrl = `vlc://${this.currentStreamUrl}`;
        window.open(vlcUrl, '_blank');

        alert('✅ 正在尝试用VLC播放...\n\n💡 如果没有自动打开，请：\n1. 复制流地址\n2. 手动打开VLC\n3. 选择"媒体" → "打开网络串流"\n4. 粘贴地址播放');
    }

    /**
     * 显示录制选项
     */
    showRecordOptions() {
        if (!this.currentStreamUrl) {
            alert('没有可用的流地址');
            return;
        }

        const resultDiv = document.getElementById('live-result');
        if (!resultDiv) return;

        const streamerName = this.currentLiveData?.owner?.nickname || 
                           this.currentLiveData?.nickname || 
                           this.currentLiveData?.anchor_name || '未知主播';

        const optionsHtml = `
            <div class="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <h5 class="font-semibold text-purple-800 mb-3">
                    <i class="fas fa-record-vinyl mr-2"></i>录制选项设置
                </h5>
                
                <div class="space-y-3 mb-4">
                    <div>
                        <label class="form-label">录制模式</label>
                        <select id="record-mode" class="form-input">
                            <option value="smart">智能录制（自动停止）</option>
                            <option value="manual">手动录制（指定时长）</option>
                        </select>
                    </div>
                    
                    <div id="duration-setting" class="hidden">
                        <label class="form-label">录制时长（分钟）</label>
                        <input type="number" id="record-duration" class="form-input" 
                               min="1" max="480" value="60" placeholder="输入录制时长...">
                    </div>
                    
                    <div>
                        <label class="form-label">录制质量</label>
                        <select id="record-quality" class="form-input">
                            <option value="copy">原始质量（推荐）</option>
                            <option value="high">高质量</option>
                            <option value="medium">中等质量</option>
                            <option value="low">低质量</option>
                        </select>
                    </div>
                </div>
                
                <div class="flex gap-3">
                    <button onclick="liveComponent.startRecording()" 
                            class="btn btn-success flex-1">
                        <i class="fas fa-record-vinyl mr-2"></i>开始录制
                    </button>
                    <button onclick="liveComponent.hideRecordOptions()" 
                            class="btn btn-secondary">
                        <i class="fas fa-times mr-2"></i>取消
                    </button>
                </div>
                
                <div class="mt-3 text-xs text-purple-600">
                    <i class="fas fa-info-circle mr-1"></i>
                    主播: ${streamerName} | 平台: ${this.currentPlatform === 'douyin' ? '抖音' : 'TikTok'}
                </div>
            </div>
        `;

        resultDiv.insertAdjacentHTML('beforeend', optionsHtml);

        // 绑定录制模式切换事件
        const recordModeSelect = document.getElementById('record-mode');
        const durationSetting = document.getElementById('duration-setting');
        
        if (recordModeSelect && durationSetting) {
            recordModeSelect.addEventListener('change', () => {
                if (recordModeSelect.value === 'manual') {
                    durationSetting.classList.remove('hidden');
                } else {
                    durationSetting.classList.add('hidden');
                }
            });
        }
    }

    /**
     * 隐藏录制选项
     */
    hideRecordOptions() {
        const optionsDiv = document.querySelector('.bg-purple-50');
        if (optionsDiv) {
            optionsDiv.remove();
        }
    }

    /**
     * 开始录制
     */
    async startRecording() {
        if (!this.currentStreamUrl || !this.currentLiveData) {
            alert('录制信息不完整');
            return;
        }

        const recordMode = document.getElementById('record-mode')?.value || 'smart';
        const recordDuration = parseInt(document.getElementById('record-duration')?.value) || 0;
        const recordQuality = document.getElementById('record-quality')?.value || 'copy';
        
        const streamerName = this.currentLiveData?.owner?.nickname || 
                           this.currentLiveData?.nickname || 
                           this.currentLiveData?.anchor_name || '未知主播';

        const duration = recordMode === 'smart' ? 0 : recordDuration;

        if (recordMode === 'manual' && duration <= 0) {
            alert('请输入有效的录制时长');
            return;
        }

        try {
            const result = await api.startRecording(
                this.currentPlatform,
                this.currentStreamUrl,
                streamerName,
                duration,
                recordQuality
            );

            if (result.success) {
                this.hideRecordOptions();
                
                const modeText = recordMode === 'smart' ? '智能录制' : `定时录制 ${duration}分钟`;
                const message = `✅ ${modeText}已启动！\n\n📺 主播: ${streamerName}\n🎥 质量: ${recordQuality}\n📁 保存位置: ${result.file_path}\n\n💡 可在文件管理中查看录制进度`;
                
                alert(message);

                // 如果是智能录制，可以添加状态监控
                if (recordMode === 'smart') {
                    this.monitorSmartRecording(result.process_id, streamerName);
                }

            } else {
                alert(`❌ 录制启动失败！\n\n错误信息: ${result.message}`);
            }

        } catch (error) {
            console.error('启动录制失败:', error);
            alert('启动录制失败: ' + error.message);
        }
    }

    /**
     * 监控智能录制状态
     */
    monitorSmartRecording(processId, streamerName) {
        const checkInterval = setInterval(async () => {
            try {
                const status = await api.getRecordingStatus();
                
                // 检查是否还在录制
                const isRecording = status.recording_tasks && 
                                  status.recording_tasks.some(task => 
                                      task.pid === processId && task.streamer_name === streamerName
                                  );

                if (!isRecording) {
                    clearInterval(checkInterval);
                    alert(`🎬 智能录制完成！\n\n📺 主播: ${streamerName}\n✅ 直播已结束，录制自动停止\n📁 文件已保存到服务器\n💾 可在文件管理中下载`);
                }
            } catch (error) {
                console.warn('检查录制状态失败:', error);
            }
        }, 30000); // 每30秒检查一次

        // 5分钟后停止监控（防止无限监控）
        setTimeout(() => {
            clearInterval(checkInterval);
        }, 300000);
    }
}

// 创建全局直播组件实例
window.LiveComponent = LiveComponent;
window.liveComponent = new LiveComponent();
