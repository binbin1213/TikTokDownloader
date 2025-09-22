# 🐳 TikTok-Downloader Docker 部署指南

## 📋 目录
- [快速开始](#快速开始)
- [环境要求](#环境要求)
- [部署方式](#部署方式)
- [配置说明](#配置说明)
- [数据持久化](#数据持久化)
- [常见问题](#常见问题)
- [进阶配置](#进阶配置)

## 🚀 快速开始

### 方式一：使用部署脚本（推荐）

```bash
# 1. 克隆项目（或下载docker-deploy.sh和docker-compose.yml）
git clone https://github.com/JoeanAmier/TikTokDownloader.git
cd TikTokDownloader

# 2. 运行一键部署脚本
./docker-deploy.sh setup
./docker-deploy.sh start

# 3. 访问Web UI
# 浏览器打开: http://localhost:5555
```

### 方式二：使用Docker Compose

```bash
# 1. 创建项目目录
mkdir tiktok-downloader && cd tiktok-downloader

# 2. 下载配置文件
wget https://raw.githubusercontent.com/JoeanAmier/TikTokDownloader/main/docker-compose.yml

# 3. 创建数据目录
mkdir -p data/{Volume,config}

# 4. 启动服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f
```

### 方式三：直接运行Docker

```bash
# 创建数据目录
mkdir -p ./data/Volume ./data/config

# 运行容器
docker run -d \
  --name tiktok-downloader \
  -p 5555:5555 \
  -v ./data/Volume:/app/Volume \
  -v ./data/config:/app/config \
  -e TZ=Asia/Shanghai \
  ghcr.io/joeanamier/tiktok-downloader:latest
```

## 💻 环境要求

### 最低配置
- **CPU**: 1核心
- **内存**: 512MB
- **存储**: 2GB可用空间
- **Docker**: 20.10+
- **Docker Compose**: 2.0+

### 推荐配置
- **CPU**: 2核心或以上
- **内存**: 2GB或以上
- **存储**: 10GB可用空间（用于下载文件）
- **网络**: 稳定的互联网连接

## 🛠️ 部署方式

### 支持的镜像仓库

```bash
# GitHub Container Registry（推荐）
ghcr.io/joeanamier/tiktok-downloader:latest

# Docker Hub
joeanamier/tiktok-downloader:latest

# 指定版本
ghcr.io/joeanamier/tiktok-downloader:5.8
```

### 支持的架构
- `linux/amd64` (x86_64)
- `linux/arm64` (ARM 64位)
- `linux/arm/v7` (ARM 32位)

## ⚙️ 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `TZ` | `UTC` | 时区设置 |
| `PYTHONUNBUFFERED` | `1` | Python输出缓冲 |
| `LANG` | `C.UTF-8` | 语言设置 |

### 端口映射

| 容器端口 | 协议 | 说明 |
|----------|------|------|
| `5555` | HTTP | Web UI和API服务 |

### 目录挂载

| 容器路径 | 说明 | 建议挂载 |
|----------|------|----------|
| `/app/Volume` | 主数据目录（下载文件、数据库等） | 必须 |
| `/app/config` | 配置文件目录（cookies、设置等） | 推荐 |

## 💾 数据持久化

### 目录结构

```
data/
├── Volume/                 # 主数据目录
│   ├── Download/          # 下载文件存储
│   │   ├── douyin/       # 抖音下载内容
│   │   │   └── live_records/  # 直播录制文件
│   │   └── tiktok/       # TikTok下载内容
│   │       └── live_records/  # 直播录制文件
│   ├── Data/             # 程序数据
│   ├── Cache/            # 缓存文件
│   └── DouK-Downloader.db # 数据库文件
└── config/               # 配置目录
    ├── settings.json     # 主配置文件
    └── cookies.json      # Cookie配置
```

### 备份建议

```bash
# 备份数据
tar -czf backup-$(date +%Y%m%d).tar.gz data/

# 恢复数据
tar -xzf backup-20240922.tar.gz
```

## 🔧 常见问题

### Q: 容器启动失败？
```bash
# 查看容器日志
docker-compose logs tiktok-downloader

# 常见解决方案：
# 1. 检查端口是否被占用
netstat -tlnp | grep 5555

# 2. 检查数据目录权限
ls -la data/
sudo chown -R 1000:1000 data/
```

### Q: Web UI无法访问？
```bash
# 检查服务状态
docker-compose ps

# 检查健康状态
curl http://localhost:5555/health

# 检查防火墙设置
sudo ufw allow 5555
```

### Q: 下载文件权限问题？
```bash
# 设置正确的用户权限
sudo chown -R 1000:1000 data/Volume/
```

### Q: FFmpeg录制失败？
```bash
# 检查FFmpeg是否可用
docker exec tiktok-downloader ffmpeg -version

# 检查磁盘空间
df -h
```

## 🔨 进阶配置

### 反向代理（Nginx）

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5555;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 使用Traefik（自动HTTPS）

```yaml
version: '3.8'
services:
  tiktok-downloader:
    image: ghcr.io/joeanamier/tiktok-downloader:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.tiktok.rule=Host(`your-domain.com`)"
      - "traefik.http.routers.tiktok.tls.certresolver=letsencrypt"
      - "traefik.http.services.tiktok.loadbalancer.server.port=5555"
    networks:
      - traefik
```

### 资源限制

```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'        # 最大CPU使用
      memory: 2G         # 最大内存使用
    reservations:
      cpus: '0.5'        # 保留CPU
      memory: 512M       # 保留内存
```

### 日志配置

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"      # 单个日志文件最大大小
    max-file: "3"        # 保留的日志文件数量
```

## 🔄 更新升级

### 自动更新脚本

```bash
#!/bin/bash
# update.sh

echo "正在更新 TikTok-Downloader..."

# 拉取最新镜像
docker-compose pull

# 重启服务
docker-compose down
docker-compose up -d

echo "更新完成！"
```

### 手动更新

```bash
# 1. 停止服务
docker-compose down

# 2. 拉取新镜像
docker-compose pull

# 3. 重启服务
docker-compose up -d

# 4. 清理旧镜像
docker image prune -f
```

## 📞 技术支持

- **项目地址**: https://github.com/JoeanAmier/TikTokDownloader
- **问题反馈**: https://github.com/JoeanAmier/TikTokDownloader/issues
- **文档说明**: https://github.com/JoeanAmier/TikTokDownloader/tree/main/docs

## 📝 更新日志

### v5.8
- ✅ 添加 Web UI 支持
- ✅ 集成 FFmpeg 用于直播录制
- ✅ 优化 Docker 镜像大小
- ✅ 添加健康检查机制
- ✅ 支持多架构构建

---

🎉 **祝你使用愉快！** 如有问题，欢迎提交 Issue 或 Pull Request。
