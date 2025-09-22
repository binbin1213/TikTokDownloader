#!/bin/bash

# 群晖 NAS 专用部署脚本
# Synology NAS specific deployment script

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# 检查并创建群晖目录
setup_synology_directories() {
    # 使用当前工作目录作为数据根目录
    local base_path="$(pwd)"
    
    log_info "创建群晖NAS目录结构: $base_path"
    
    # 创建主目录
    sudo mkdir -p "$base_path/Volume/Download/douyin/live_records"
    sudo mkdir -p "$base_path/Volume/Download/douyin/audio"
    sudo mkdir -p "$base_path/Volume/Download/douyin/videos"
    sudo mkdir -p "$base_path/Volume/Download/douyin/images"
    sudo mkdir -p "$base_path/Volume/Data"
    sudo mkdir -p "$base_path/Volume/Cache"
    sudo mkdir -p "$base_path/config"
    
    # 设置权限 - 确保appuser(1000:1000)可以读写
    sudo chown -R 1000:1000 "$base_path"
    sudo chmod -R 755 "$base_path"
    
    # 特别确保Volume目录可写（数据库文件位置）
    sudo chmod -R 777 "$base_path/Volume"
    sudo chmod -R 777 "$base_path/config"
    
    log_success "群晖目录创建完成: $base_path"
}

# 生成默认配置
create_default_config() {
    local config_path="$(pwd)/config/settings.json"
    
    if [ ! -f "$config_path" ]; then
        log_info "创建默认配置文件..."
        
        sudo tee "$config_path" > /dev/null << 'CONFIG_EOF'
{
    "root": "/app/Volume",
    "folder_name": "Download",
    "name_format": "create_time nickname desc",
    "date_format": "%Y-%m-%d %H:%M:%S",
    "split": "-",
    "folder_mode": false,
    "music": false,
    "storage_format": "",
    "cookie": "",
    "dynamic_cover": false,
    "original_cover": false,
    "proxy": "",
    "download": 1,
    "max_size": 0,
    "chunk": 1048576,
    "max_retry": 5,
    "record_data": false,
    "owner_url": false,
    "ffmpeg": "",
    "thread": false
}
CONFIG_EOF
        
        sudo chown 1000:1000 "$config_path"
        log_success "配置文件创建完成"
    else
        log_info "配置文件已存在，跳过创建"
    fi
}

# 检查容器状态
check_container_status() {
    local container_name="tiktok-downloader"
    
    if docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        log_warning "检测到容器 '$container_name' 正在运行"
        echo "请选择操作:"
        echo "  1) 停止并重新启动 (推荐用于更新)"
        echo "  2) 强制重新创建 (用于配置变更)"
        echo "  3) 取消操作"
        echo -n "请输入选择 [1-3]: "
        read -r choice
        
        case $choice in
            1)
                log_info "停止现有容器并重新启动..."
                docker-compose down
                return 0
                ;;
            2)
                log_info "强制重新创建容器..."
                docker-compose down --volumes
                docker-compose pull
                return 0
                ;;
            3)
                log_info "操作已取消"
                return 1
                ;;
            *)
                log_error "无效选择，操作已取消"
                return 1
                ;;
        esac
    elif docker ps -a --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        log_info "检测到已停止的容器，将重新启动..."
        docker-compose down 2>/dev/null || true
        return 0
    else
        log_info "未检测到现有容器，将创建新容器..."
        return 0
    fi
}

# 显示使用说明
show_usage() {
    echo "群晖 NAS 部署脚本"
    echo
    echo "使用方法:"
    echo "  1. 设置目录: sudo $0 setup"
    echo "  2. 启动服务: $0 start"
    echo "  3. 停止服务: $0 stop"
    echo "  4. 查看日志: $0 logs"
    echo "  5. 更新服务: $0 update"
    echo "  6. 重新部署: $0 redeploy"
    echo
    echo "注意: setup 命令需要 sudo 权限来创建目录"
}

# 主要操作
case "${1:-help}" in
    setup)
        setup_synology_directories
        create_default_config
        log_success "群晖环境设置完成!"
        log_info "现在可以运行 '$0 start' 启动服务"
        ;;
    start)
        log_info "启动服务 (使用群晖配置)..."
        
        # 检查并修复权限（防止数据库权限问题）
        base_path="$(pwd)"
        log_info "检查目录权限..."
        sudo chown -R 1000:1000 "$base_path"
        sudo chmod -R 777 "$base_path/Volume" 2>/dev/null || true
        sudo chmod -R 777 "$base_path/config" 2>/dev/null || true
        
        if check_container_status; then
            docker-compose up -d
            log_success "服务已启动! 访问: http://localhost:5555"
        else
            log_warning "启动操作已取消"
        fi
        ;;
    stop)
        log_info "停止服务..."
        docker-compose down
        log_success "服务已停止"
        ;;
    logs)
        docker-compose logs -f
        ;;
    update)
        log_info "更新服务..."
        docker-compose pull
        docker-compose up -d
        log_success "服务已更新"
        ;;
    restart)
        $0 stop
        sleep 2
        $0 start
        ;;
    redeploy)
        log_info "重新部署服务（强制重新创建）..."
        log_warning "这将停止容器并拉取最新镜像"
        echo -n "确定继续吗? [y/N]: "
        read -r confirm
        if [[ "$confirm" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            docker-compose down --volumes
            docker-compose pull
            docker-compose up -d
            log_success "重新部署完成! 访问: http://localhost:5555"
        else
            log_info "重新部署已取消"
        fi
        ;;
    *)
        show_usage
        ;;
esac
