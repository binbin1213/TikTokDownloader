# 群晖 NAS 部署指南

本文档专门为群晖 NAS 用户提供部署指导。

## 💡 轻量化部署

- 🐳 **应用在Docker镜像中** - 源码和依赖已打包在 `ghcr.io/binbin1213/tiktokdownloader:latest`
- ⚡ **只需10KB配置文件** - 无需下载完整代码仓库（200MB+）
- 🚀 **秒级部署** - 下载配置文件后立即可用
- 🔄 **一键更新** - `docker-compose pull` 获取最新版本

## 🚀 快速部署

### 1. 前置要求
- 群晖 NAS 已安装 Docker 套件
- SSH 访问权限
- 足够的存储空间（建议至少 10GB）

### 2. 部署步骤

#### 方法一：一键部署（最简单）

```bash
# 只需一个命令，全自动部署
wget -O- https://raw.githubusercontent.com/binbin1213/TikTokDownloader/master/synology-quick-deploy.sh | bash
```

#### 方法二：手动部署（推荐）

```bash
# 1. 创建工作目录
mkdir -p /volume1/docker/tiktok-downloader
cd /volume1/docker/tiktok-downloader

# 2. 下载配置文件（只需要这几个文件）
wget https://raw.githubusercontent.com/binbin1213/TikTokDownloader/master/docker-compose.yml
wget https://raw.githubusercontent.com/binbin1213/TikTokDownloader/master/.env.synology
wget https://raw.githubusercontent.com/binbin1213/TikTokDownloader/master/docker-deploy-synology.sh
chmod +x docker-deploy-synology.sh

# 3. 设置群晖环境
sudo ./docker-deploy-synology.sh setup

# 4. 启动服务
./docker-deploy-synology.sh start

# 5. 访问服务
# 浏览器打开: http://你的群晖IP:5555
```


### 3. 常用命令

```bash
# 查看服务状态
./docker-deploy-synology.sh logs

# 停止服务
./docker-deploy-synology.sh stop

# 重启服务
./docker-deploy-synology.sh restart

# 更新到最新版本
./docker-deploy-synology.sh update
```

## 📁 数据目录

数据存储在 `/volume1/docker/douyin/`：
- `Volume/Download/` - 下载的视频、图片、音频
- `config/settings.json` - 应用配置文件

## 🔧 自定义配置

如需修改配置，编辑 `.env.synology` 文件：

```bash
# 修改数据路径
DATA_PATH=/volume1/docker/douyin

# 修改端口（如果5555被占用）
HOST_PORT=5556

# 修改时区
TZ=Asia/Shanghai
```

## 📂 所需文件

群晖部署只需要这几个轻量级配置文件：

- `docker-compose.yml` (2KB) - Docker服务配置
- `.env.synology` (300B) - 群晖环境变量  
- `docker-deploy-synology.sh` (4KB) - 部署脚本

**总大小不到10KB**，无需下载完整源码仓库！

## 🔍 故障排除

### 权限问题
```bash
# 修复权限
sudo chown -R 1000:1000 /volume1/docker/douyin
sudo chmod -R 755 /volume1/docker/douyin
```

### 端口冲突
```bash
# 修改 .env.synology 文件中的 HOST_PORT
HOST_PORT=5556
```

### 存储空间不足
- 检查 `/volume1` 的可用空间
- 清理旧的下载文件
- 考虑使用外部存储

## 📞 支持

如遇问题，请检查：
1. Docker 套件是否正常运行
2. 网络连接是否正常
3. 存储空间是否充足
4. 权限设置是否正确

更多帮助请参考主项目文档。
