# ---- 阶段 1: 构建器 (Builder) ----
# 使用一个功能完整的镜像，它包含编译工具或可以轻松安装它们
FROM python:3.12-bullseye AS builder

# 安装编译 uvloop 和 httptools 所需的系统依赖 (C编译器等)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# 设置工作目录
WORKDIR /app

# 复制需求文件
COPY requirements.txt .

# 在这个具备编译环境的阶段安装所有 Python 依赖
# 安装到一个独立的目录 /install 中，以便后续复制
RUN pip install --no-cache-dir --prefix="/install" -r requirements.txt

# ---- 阶段 2: 最终镜像 (Final Image) ----
# 使用轻量级 slim 镜像作为最终的运行环境
FROM python:3.12-slim

# 设置工作目录
WORKDIR /app

# 添加元数据标签
LABEL name="DouK-Downloader" \
      authors="JoeanAmier" \
      repository="https://github.com/JoeanAmier/TikTokDownloader" \
      description="TikTok/抖音 数据采集工具，支持Web UI和直播录制"

# 安装系统依赖：FFmpeg用于直播录制，curl用于健康检查
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 从构建器阶段，将已经安装好的依赖包复制到最终镜像的系统路径中
COPY --from=builder /install /usr/local

# 复制应用程序代码和相关文件
COPY src /app/src
COPY webui /app/webui
COPY locale /app/locale
COPY static /app/static
COPY license /app/license
COPY main.py /app/main.py

# 创建应用用户（安全最佳实践）
RUN groupadd -r appuser && useradd -r -g appuser appuser

# 创建必要的目录并设置权限
RUN mkdir -p /app/Volume/Download \
             /app/Volume/Data \
             /app/Volume/Cache \
             /app/config && \
    chown -R appuser:appuser /app/Volume /app/config

# 暴露端口
EXPOSE 5555

# 创建挂载点
VOLUME ["/app/Volume", "/app/config"]

# 切换到非特权用户
USER appuser

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5555/health || exit 1

# 设置环境变量
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# 复制启动脚本
COPY start_server.py /app/start_server.py
RUN chmod +x /app/start_server.py

# 设置容器启动命令 - 直接启动Web API模式
CMD ["python", "/app/start_server.py"]