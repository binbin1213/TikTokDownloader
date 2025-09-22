#!/usr/bin/env python3
"""
Docker容器启动脚本 - 直接启动Web API服务器
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
sys.path.insert(0, '/app')

from src.application import TikTokDownloader


async def main():
    """启动Web API服务器"""
    print("🚀 启动 DouK-Downloader Web API 服务器...")
    print("📍 服务器地址: http://0.0.0.0:5555")
    print("🎨 Web UI 地址: http://0.0.0.0:5555")
    print("📚 API 文档: http://0.0.0.0:5555/docs")
    print("-" * 60)
    
    try:
        async with TikTokDownloader() as app:
            await app.server()
    except KeyboardInterrupt:
        print("\n👋 服务器已停止")
    except Exception as e:
        print(f"❌ 启动失败: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
