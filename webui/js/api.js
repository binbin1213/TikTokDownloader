/**
 * API调用封装
 */
class API {
    constructor() {
        // 自动检测API地址：如果是通过反向代理访问，使用当前域名；否则使用localhost
        const defaultAPI = window.location.protocol === 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
            ? `${window.location.protocol}//${window.location.host}`
            : 'http://127.0.0.1:5555';
        
        this.baseURL = localStorage.getItem('api-server') || defaultAPI;
        this.token = localStorage.getItem('api-token') || '';
    }

    /**
     * 通用API请求方法
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // 添加token
        if (this.token) {
            config.headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API请求失败:', error);
            throw error;
        }
    }

    /**
     * 表单数据请求
     */
    async postForm(endpoint, formData, method = 'POST') {
        const url = `${this.baseURL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                method: method,
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('表单请求失败:', error);
            throw error;
        }
    }

    /**
     * JSON数据请求
     */
    async postJSON(endpoint, data, method = 'POST') {
        const url = `${this.baseURL}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.token && { 'Authorization': `Bearer ${this.token}` })
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('JSON请求失败:', error);
            throw error;
        }
    }

    // ==================== 链接解析API ====================
    
    /**
     * 提取作品/直播间ID（支持短链接解析）
     */
    async extractWorkId(text, type = 'detail') {
        const data = {
            text: text,
            type: type  // 支持 'detail' 或 'live'
        };
        
        return await this.postJSON('/extract/work_id', data);
    }
    
    // ==================== 下载相关API ====================
    
    /**
     * 获取单个作品信息
     */
    async getWorkDetail(platform, workId, cookie = '', proxy = '') {
        const data = {
            detail_id: workId,
            cookie: cookie,
            proxy: proxy,
            source: false
        };

        console.log('🌐 发送API请求:', {
            endpoint: `/${platform}/detail`,
            data: {
                detail_id: workId,
                hasCookie: !!cookie,
                cookieLength: cookie ? cookie.length : 0,
                proxy: proxy || '无代理',
                source: false
            }
        });

        try {
            const result = await this.postJSON(`/${platform}/detail`, data);
            console.log('✅ API请求成功:', {
                success: result.success,
                message: result.message,
                hasData: !!result.data
            });
            return result;
        } catch (error) {
            console.error('❌ API请求失败:', error);
            throw error;
        }
    }

    /**
     * 获取账号作品
     */
    async getAccountWorks(platform, accountId, cookie = '', proxy = '') {
        const data = {
            sec_uid: accountId,
            cookie: cookie,
            proxy: proxy,
            source: false
        };

        return await this.postJSON(`/${platform}/account`, data);
    }

    /**
     * 获取直播信息
     */
    async getLiveInfo(platform, liveId, cookie = '', proxy = '') {
        const paramName = platform === 'douyin' ? 'web_rid' : 'room_id';
        const data = {
            [paramName]: liveId,
            cookie: cookie,
            proxy: proxy,
            source: false
        };

        return await this.postJSON(`/${platform}/live`, data);
    }

    /**
     * 搜索作品
     */
    async searchWorks(platform, keyword, cookie = '', proxy = '') {
        const data = {
            keyword: keyword,
            cookie: cookie,
            proxy: proxy,
            source: false
        };

        return await this.postJSON(`/${platform}/search/general`, data);
    }

    /**
     * 下载文件到服务器
     */
    async downloadToServer(url, platform, title, author) {
        const data = new URLSearchParams({
            url: url,
            platform: platform,
            title: title,
            author: author
        });

        return await this.postForm('/download/file', data);
    }

    /**
     * 检查文件是否已下载
     */
    async checkDownloaded(title, author, platform) {
        const data = new URLSearchParams({
            title: title,
            author: author,
            platform: platform
        });

        return await this.postForm('/check/downloaded', data);
    }

    // ==================== 录制相关API ====================

    /**
     * 开始录制直播
     */
    async startRecording(platform, streamUrl, streamerName, duration = 0, quality = 'copy') {
        const data = new URLSearchParams({
            platform: platform,
            stream_url: streamUrl,
            streamer_name: streamerName,
            duration: duration.toString(),
            quality: quality
        });

        return await this.postForm('/record/live', data);
    }

    /**
     * 获取录制状态
     */
    async getRecordingStatus() {
        return await this.request('/record/status');
    }

    /**
     * 停止录制
     */
    async stopRecording(processId, streamerName) {
        const data = new URLSearchParams({
            process_id: processId.toString(),
            streamer_name: streamerName
        });

        return await this.postForm('/record/stop', data);
    }

    // ==================== 数据库相关API ====================

    /**
     * 保存下载历史到数据库
     */
    async saveDownloadHistory(historyData) {
        const data = new URLSearchParams(historyData);
        return await this.postForm('/database/download_history', data);
    }

    /**
     * 获取下载历史
     */
    async getDownloadHistory(limit = 50, offset = 0, platform = null) {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString()
        });
        
        if (platform) {
            params.append('platform', platform);
        }

        return await this.request(`/database/download_history?${params}`);
    }

    /**
     * 获取录制历史
     */
    async getRecordingHistory(limit = 50, offset = 0, status = null) {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString()
        });
        
        if (status) {
            params.append('status', status);
        }

        return await this.request(`/database/recording_history?${params}`);
    }

    // ==================== 设置相关API ====================

    /**
     * 保存Cookie设置
     */
    async saveCookieSettings(douyinCookie, tiktokCookie) {
        const data = new URLSearchParams({
            douyin_cookie: douyinCookie,
            tiktok_cookie: tiktokCookie
        });

        return await this.postForm('/settings/cookie', data);
    }

    /**
     * 获取Cookie设置
     */
    async getCookieSettings() {
        return await this.request('/settings/cookie');
    }

    /**
     * 检查密码设置状态
     */
    async getPasswordStatus() {
        return await this.request('/settings/password/status');
    }

    /**
     * 验证访问密码
     */
    async verifyPassword(password) {
        const data = new URLSearchParams({
            password: password
        });
        return await this.postForm('/settings/verify', data);
    }

    /**
     * 设置访问密码
     */
    async setPassword(password, oldPassword = '') {
        const data = new URLSearchParams({
            password: password,
            old_password: oldPassword
        });
        return await this.postForm('/settings/password', data);
    }

    // ==================== 文件管理API ====================

    /**
     * 下载服务器文件到本地
     */
    downloadFromServer(platform, filename) {
        const url = `${this.baseURL}/download/local/${platform}/${filename}`;
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // ==================== 工具方法 ====================

    /**
     * 更新API服务器地址
     */
    updateBaseURL(newURL) {
        this.baseURL = newURL;
        localStorage.setItem('api-server', newURL);
    }

    /**
     * 更新API Token
     */
    updateToken(newToken) {
        this.token = newToken;
        localStorage.setItem('api-token', newToken);
    }

    /**
     * 检查API状态
     */
    async checkStatus() {
        try {
            // 尝试访问API文档页面来检查服务器状态
            const response = await fetch(`${this.baseURL}/docs`, { 
                method: 'GET',
                timeout: 5000 
            });
            return response.ok;
        } catch (error) {
            // 如果docs也不存在，尝试一个简单的GET请求
            try {
                const response = await fetch(this.baseURL, { 
                    method: 'HEAD',  // 使用HEAD请求减少响应数据
                    timeout: 5000 
                });
                // 只要服务器响应了就认为是在线的，不管状态码
                return true;
            } catch (fallbackError) {
                return false;
            }
        }
    }

    // ==================== 存储统计API ====================

    /**
     * 获取存储统计信息
     */
    async getStorageStats() {
        return await this.request('/storage/stats');
    }

    /**
     * 删除录制文件
     */
    async deleteRecordingFile(platform, filename) {
        const data = new FormData();
        data.append('platform', platform);
        data.append('filename', filename);
        
        return await this.postForm('/storage/file', data, 'DELETE');
    }
}

// 创建全局API实例
window.api = new API();
