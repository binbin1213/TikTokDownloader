#!/bin/bash

# TikTok-Downloader Docker 部署脚本
# 作者: TikTok-Downloader Team
# 用途: 快速部署和管理 TikTok-Downloader 容器

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
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

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装或未在PATH中找到"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
}

# 创建必要的目录
setup_directories() {
    log_info "创建数据目录..."
    
    mkdir -p data/Volume/Download/douyin/live_records
    mkdir -p data/Volume/Download/tiktok/live_records
    mkdir -p data/Volume/Data
    mkdir -p data/Volume/Cache
    mkdir -p data/config
    
    # 设置权限（适用于Linux）
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo chown -R 1000:1000 data/
    fi
    
    log_success "目录创建完成"
}

# 下载配置文件模板
setup_config() {
    log_info "设置配置文件..."
    
    if [ ! -f "data/config/settings.json" ]; then
        log_info "创建默认配置文件 settings.json"
        cat > data/config/settings.json << 'EOF'
{
    "root": "",
    "folder_name": "Download",
    "name_format": "create_time type nickname desc",
    "desc_length": 64,
    "name_length": 128,
    "date_format": "%Y-%m-%d %H:%M:%S",
    "split": "-",
    "folder_mode": false,
    "music": false,
    "download": true,
    "max_size": 0,
    "chunk": 2097152,
    "timeout": 10,
    "max_retry": 5,
    "max_pages": 0,
    "douyin_platform": true,
    "tiktok_platform": true,
    "cookie": "",
    "cookie_tiktok": "",
    "proxy": "",
    "proxy_tiktok": ""
}
EOF
    fi
    
    log_success "配置文件设置完成"
}

# 拉取最新镜像
pull_image() {
    log_info "拉取最新镜像..."
    docker-compose pull || docker compose pull
    log_success "镜像拉取完成"
}

# 启动服务
start_service() {
    log_info "启动 TikTok-Downloader 服务..."
    docker-compose up -d || docker compose up -d
    
    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10
    
    # 检查服务状态
    if docker-compose ps | grep -q "Up" || docker compose ps | grep -q "running"; then
        log_success "服务启动成功！"
        log_info "Web UI 访问地址: http://localhost:5555"
        log_info "API 文档地址: http://localhost:5555/docs"
    else
        log_error "服务启动失败"
        docker-compose logs || docker compose logs
        exit 1
    fi
}

# 停止服务
stop_service() {
    log_info "停止服务..."
    docker-compose down || docker compose down
    log_success "服务已停止"
}

# 查看日志
show_logs() {
    docker-compose logs -f || docker compose logs -f
}

# 更新服务
update_service() {
    log_info "更新服务..."
    pull_image
    docker-compose down || docker compose down
    start_service
}

# 清理资源
cleanup() {
    log_warning "这将删除所有容器、镜像和卷，确定继续吗？(y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        docker-compose down -v --rmi all || docker compose down -v --rmi all
        log_success "清理完成"
    else
        log_info "取消清理操作"
    fi
}

# 显示帮助信息
show_help() {
    echo "TikTok-Downloader Docker 部署脚本"
    echo
    echo "用法: $0 [命令]"
    echo
    echo "命令:"
    echo "  setup    - 初始化环境（创建目录和配置）"
    echo "  start    - 启动服务"
    echo "  stop     - 停止服务"
    echo "  restart  - 重启服务"
    echo "  update   - 更新服务到最新版本"
    echo "  logs     - 查看服务日志"
    echo "  status   - 查看服务状态"
    echo "  cleanup  - 清理所有资源"
    echo "  help     - 显示此帮助信息"
    echo
    echo "示例:"
    echo "  $0 setup    # 首次部署时运行"
    echo "  $0 start    # 启动服务"
    echo "  $0 logs     # 查看日志"
}

# 查看状态
show_status() {
    log_info "服务状态:"
    docker-compose ps || docker compose ps
    echo
    log_info "磁盘使用情况:"
    du -sh data/ 2>/dev/null || echo "数据目录不存在"
}

# 主函数
main() {
    case "$1" in
        setup)
            check_docker
            setup_directories
            setup_config
            pull_image
            log_success "初始化完成！现在可以运行 '$0 start' 启动服务"
            ;;
        start)
            check_docker
            start_service
            ;;
        stop)
            stop_service
            ;;
        restart)
            stop_service
            start_service
            ;;
        update)
            check_docker
            update_service
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            if [ -z "$1" ]; then
                show_help
            else
                log_error "未知命令: $1"
                show_help
                exit 1
            fi
            ;;
    esac
}

# 运行主函数
main "$@"
