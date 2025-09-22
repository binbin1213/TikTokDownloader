# 群晖 NAS 部署指南

本文档专门为群晖 NAS 用户提供部署指导。

## 💡 部署原理

**为什么不需要下载完整代码？**

- 🐳 **应用程序已打包在Docker镜像中** - 所有源代码、依赖都在 `ghcr.io/binbin1213/tiktokdownloader:latest`
- 📋 **只需配置文件** - 仅需要 `docker-compose.yml`、`.env.synology` 和部署脚本
- ⚡ **更快部署** - 无需下载几百MB的源码，只下载几KB的配置文件
- 🔄 **自动更新** - 运行 `docker-compose pull` 即可获取最新镜像

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

#### 方法三：完整克隆（开发者）

```bash
# 只有需要源码时才使用此方法
cd /volume1/docker
git clone https://github.com/binbin1213/TikTokDownloader.git
cd TikTokDownloader
sudo ./docker-deploy-synology.sh setup
./docker-deploy-synology.sh start
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

## 📁 目录结构

群晖专用目录结构（位于 `/volume1/docker/douyin/`）：

```
/volume1/docker/douyin/
├── Volume/
│   ├── Download/        # 下载文件存储
│   │   └── douyin/
│   │       ├── videos/  # 视频文件
│   │       ├── images/  # 图片文件
│   │       ├── audio/   # 音频文件
│   │       └── live_records/ # 直播录制
│   ├── Data/           # 数据库文件
│   └── Cache/          # 缓存文件
└── config/
    └── settings.json   # 配置文件
```

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

## 🆚 与通用版本的区别

| 特性 | 通用版本 | 群晖版本 |
|------|----------|----------|
| 数据路径 | `./data/` | `/volume1/docker/douyin/` |
| 部署脚本 | `docker-deploy.sh` | `docker-deploy-synology.sh` |
| 环境配置 | 默认 | `.env.synology` |
| 权限设置 | 自动 | 需要sudo设置 |

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
