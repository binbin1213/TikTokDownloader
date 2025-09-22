#!/bin/bash

# 数据库问题诊断脚本
# Database issue diagnosis script

echo "=========================================="
echo "🔍 TikTok-Downloader 数据库问题诊断"
echo "=========================================="
echo

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. 检查当前目录和文件结构
log_info "1. 检查目录结构..."
echo "当前目录: $(pwd)"
echo "目录内容:"
ls -la

echo
log_info "检查Volume目录..."
if [ -d "Volume" ]; then
    ls -la Volume/
    echo "Volume目录权限: $(stat -c '%a %U:%G' Volume)"
else
    log_error "Volume目录不存在！"
fi

echo
log_info "检查config目录..."
if [ -d "config" ]; then
    ls -la config/
    echo "config目录权限: $(stat -c '%a %U:%G' config)"
else
    log_error "config目录不存在！"
fi

# 2. 检查容器状态
echo
log_info "2. 检查容器状态..."
if docker ps --format "table {{.Names}}\t{{.Status}}" | grep tiktok-downloader; then
    log_success "容器正在运行"
else
    log_warning "容器未运行，检查已停止的容器..."
    docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep tiktok-downloader
fi

# 3. 检查Docker挂载
echo
log_info "3. 检查Docker挂载配置..."
if [ -f "docker-compose.yml" ]; then
    echo "Volume挂载配置:"
    grep -A5 -B5 "volumes:" docker-compose.yml
else
    log_error "docker-compose.yml文件不存在！"
fi

# 4. 测试容器内权限
echo
log_info "4. 测试容器内文件创建..."
if docker ps --format "{{.Names}}" | grep -q tiktok-downloader; then
    log_info "容器正在运行，测试文件创建权限..."
    
    echo "容器内用户信息:"
    docker exec tiktok-downloader whoami
    docker exec tiktok-downloader id
    
    echo "容器内Volume目录:"
    docker exec tiktok-downloader ls -la /app/Volume/
    
    echo "测试创建文件:"
    if docker exec tiktok-downloader touch /app/Volume/permission_test.txt; then
        log_success "可以在Volume目录创建文件"
        docker exec tiktok-downloader rm /app/Volume/permission_test.txt
    else
        log_error "无法在Volume目录创建文件！"
    fi
    
    echo "尝试创建数据库文件:"
    if docker exec tiktok-downloader touch /app/Volume/test_database.db; then
        log_success "可以创建数据库文件"
        docker exec tiktok-downloader rm /app/Volume/test_database.db
    else
        log_error "无法创建数据库文件！"
    fi
else
    log_warning "容器未运行，无法测试内部权限"
fi

# 5. 检查磁盘空间
echo
log_info "5. 检查磁盘空间..."
df -h $(pwd)

# 6. 环境变量检查
echo
log_info "6. 检查环境变量..."
if [ -f ".env" ]; then
    echo "环境变量文件内容:"
    cat .env
else
    log_error ".env文件不存在！"
fi

# 7. 尝试手动修复权限
echo
log_info "7. 尝试修复权限..."
echo "修复前的权限:"
ls -la

sudo chown -R 1000:1000 .
sudo chmod -R 755 .
sudo chmod -R 777 Volume/ config/ 2>/dev/null || true

echo "修复后的权限:"
ls -la
if [ -d "Volume" ]; then
    echo "Volume目录权限: $(stat -c '%a %U:%G' Volume)"
fi
if [ -d "config" ]; then
    echo "config目录权限: $(stat -c '%a %U:%G' config)"
fi

echo
log_info "诊断完成！请查看上述输出来定位问题。"
echo
echo "💡 常见解决方案:"
echo "  1. 如果权限问题: 运行 sudo chmod -R 777 Volume config"
echo "  2. 如果挂载问题: 检查 .env 文件中的 DATA_PATH 设置"
echo "  3. 如果磁盘空间不足: 清理磁盘空间"
echo "  4. 如果容器问题: 运行 docker-compose down && docker-compose up -d"
