#!/bin/bash

# 群晖 NAS 一键部署脚本
# Synology NAS one-click deployment script

set -e

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

# 检查Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装或未在PATH中找到"
        log_info "请先在群晖控制面板中安装 Docker 套件"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
}

# 下载配置文件
download_configs() {
    local base_url="https://raw.githubusercontent.com/binbin1213/TikTokDownloader/master"
    
    log_info "下载配置文件..."
    
    # 下载必需文件
    if ! wget -q "$base_url/docker-compose.yml"; then
        log_error "下载 docker-compose.yml 失败"
        exit 1
    fi
    
    if ! wget -q "$base_url/.env.synology"; then
        log_error "下载 .env.synology 失败"
        exit 1
    fi
    
    if ! wget -q "$base_url/docker-deploy-synology.sh"; then
        log_error "下载 docker-deploy-synology.sh 失败"
        exit 1
    fi
    
    chmod +x docker-deploy-synology.sh
    log_success "配置文件下载完成"
}

# 主函数
main() {
    echo "========================================"
    echo "🚀 TikTok-Downloader 群晖一键部署"
    echo "========================================"
    echo
    
    # 检查环境
    check_docker
    
    # 创建工作目录（与数据目录同级）
    local work_dir="/volume1/docker/douyin"
    log_info "创建工作目录: $work_dir"
    mkdir -p "$work_dir"
    cd "$work_dir"
    
    # 下载配置文件
    download_configs
    
    # 设置环境
    log_info "设置群晖环境..."
    if sudo ./docker-deploy-synology.sh setup; then
        log_success "环境设置完成"
    else
        log_error "环境设置失败"
        exit 1
    fi
    
    # 启动服务
    log_info "启动服务..."
    if ./docker-deploy-synology.sh start; then
        log_success "服务启动成功！"
        echo
        echo "🎉 部署完成！"
        echo "📍 访问地址: http://$(hostname -I | awk '{print $1}'):5555"
        echo "📁 数据目录: /volume1/docker/douyin/"
        echo "📋 工作目录: $work_dir"
        echo
        echo "常用命令:"
        echo "  查看日志: cd $work_dir && ./docker-deploy-synology.sh logs"
        echo "  停止服务: cd $work_dir && ./docker-deploy-synology.sh stop"
        echo "  更新服务: cd $work_dir && ./docker-deploy-synology.sh update"
    else
        log_error "服务启动失败"
        exit 1
    fi
}

# 执行主函数
main "$@"
