from textwrap import dedent
from time import time
from types import SimpleNamespace
from typing import TYPE_CHECKING

from fastapi import Depends, FastAPI, Form, Header, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from uvicorn import Config, Server
from pathlib import Path

from ..custom import (
    __VERSION__,
    REPOSITORY,
    SERVER_HOST,
    SERVER_PORT,
    VERSION_BETA,
    is_valid_token,
)
from ..models import (
    Account,
    AccountTiktok,
    Comment,
    DataResponse,
    Detail,
    DetailTikTok,
    GeneralSearch,
    Live,
    LiveSearch,
    LiveTikTok,
    Mix,
    MixTikTok,
    Reply,
    Settings,
    ShortUrl,
    UrlResponse,
    UserSearch,
    VideoSearch,
)
from ..translation import _
from .main_terminal import TikTok

if TYPE_CHECKING:
    from ..config import Parameter
    from ..manager import Database

__all__ = ["APIServer"]


def token_dependency(token: str = Header(None)):
    if not is_valid_token(token):
        raise HTTPException(
            status_code=403,
            detail=_("验证失败！"),
        )


class APIServer(TikTok):
    def __init__(
        self,
        parameter: "Parameter",
        database: "Database",
        server_mode: bool = True,
    ):
        super().__init__(
            parameter,
            database,
            server_mode,
        )
        self.server = None

    async def handle_redirect(self, text: str, proxy: str = None) -> str:
        return await self.links.run(
            text,
            "",
            proxy,
        )

    async def handle_redirect_tiktok(self, text: str, proxy: str = None) -> str:
        return await self.links_tiktok.run(
            text,
            "",
            proxy,
        )

    async def run_server(
        self,
        host=SERVER_HOST,
        port=SERVER_PORT,
        log_level="info",
    ):
        self.server = FastAPI(
            debug=VERSION_BETA,
            title="DouK-Downloader",
            version=__VERSION__,
        )
        self.setup_routes()
        self.setup_static_files()
        config = Config(
            self.server,
            host=host,
            port=port,
            log_level=log_level,
        )
        server = Server(config)
        await server.serve()

    def setup_routes(self):
        @self.server.get(
            "/",
            summary=_("Web UI 主页"),
            description=_("访问 DouK-Downloader Web UI 界面"),
            tags=[_("项目")],
        )
        async def index():
            webui_path = Path(__file__).parent.parent.parent / "webui" / "index.html"
            if webui_path.exists():
                return FileResponse(webui_path)
            else:
                return RedirectResponse(url=REPOSITORY)
        
        @self.server.get(
            "/github",
            summary=_("访问项目 GitHub 仓库"),
            description=_("重定向至项目 GitHub 仓库主页"),
            tags=[_("项目")],
        )
        async def github():
            return RedirectResponse(url=REPOSITORY)

        @self.server.get(
            "/token",
            summary=_("测试令牌有效性"),
            description=_(
                dedent("""
                项目默认无需令牌；公开部署时，建议设置令牌以防止恶意请求！
                
                令牌设置位置：`src/custom/function.py` - `is_valid_token()`
                """)
            ),
            tags=[_("项目")],
            response_model=DataResponse,
        )
        async def handle_test(token: str = Depends(token_dependency)):
            return DataResponse(
                message=_("验证成功！"),
                data=None,
                params=None,
            )

        @self.server.post(
            "/settings",
            summary=_("更新项目全局配置"),
            description=_(
                dedent("""
                更新项目配置文件 settings.json
                
                仅需传入需要更新的配置参数
                
                返回更新后的全部配置参数
                """)
            ),
            tags=[_("配置")],
            response_model=Settings,
        )
        async def handle_settings(
            extract: Settings, token: str = Depends(token_dependency)
        ):
            await self.parameter.set_settings_data(extract.model_dump())
            return Settings(**self.parameter.get_settings_data())

        @self.server.get(
            "/settings",
            summary=_("获取项目全局配置"),
            description=_("返回项目全部配置参数"),
            tags=[_("配置")],
            response_model=Settings,
        )
        async def get_settings(token: str = Depends(token_dependency)):
            return Settings(**self.parameter.get_settings_data())

        @self.server.post(
            "/douyin/share",
            summary=_("获取分享链接重定向的完整链接"),
            description=_(
                dedent("""
                **参数**:
                
                - **text**: 包含分享链接的字符串；必需参数
                - **proxy**: 代理；可选参数
                """)
            ),
            tags=[_("抖音")],
            response_model=UrlResponse,
        )
        async def handle_share(
            extract: ShortUrl, token: str = Depends(token_dependency)
        ):
            if url := await self.handle_redirect(extract.text, extract.proxy):
                return UrlResponse(
                    message=_("请求链接成功！"),
                    url=url,
                    params=extract.model_dump(),
                )
            return UrlResponse(
                message=_("请求链接失败！"),
                url=None,
                params=extract.model_dump(),
            )

        @self.server.post(
            "/douyin/detail",
            summary=_("获取单个作品数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **detail_id**: 抖音作品 ID；必需参数
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_detail(
            extract: Detail, token: str = Depends(token_dependency)
        ):
            return await self.handle_detail(extract, False)

        @self.server.post(
            "/douyin/account",
            summary=_("获取账号作品数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **sec_user_id**: 抖音账号 sec_uid；必需参数
                - **tab**: 账号页面类型；可选参数，默认值：`post`
                - **earliest**: 作品最早发布日期；可选参数
                - **latest**: 作品最晚发布日期；可选参数
                - **pages**: 最大请求次数，仅对请求账号喜欢页数据有效；可选参数
                - **cursor**: 可选参数
                - **count**: 可选参数
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_account(
            extract: Account, token: str = Depends(token_dependency)
        ):
            return await self.handle_account(extract, False)

        @self.server.post(
            "/douyin/mix",
            summary=_("获取合集作品数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **mix_id**: 抖音合集 ID
                - **detail_id**: 属于合集的抖音作品 ID
                - **cursor**: 可选参数
                - **count**: 可选参数
                
                **`mix_id` 和 `detail_id` 二选一，只需传入其中之一即可**
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_mix(extract: Mix, token: str = Depends(token_dependency)):
            is_mix, id_ = self.generate_mix_params(
                extract.mix_id,
                extract.detail_id,
            )
            if not isinstance(is_mix, bool):
                return DataResponse(
                    message=_("参数错误！"),
                    data=None,
                    params=extract.model_dump(),
                )
            if data := await self.deal_mix_detail(
                is_mix,
                id_,
                api=True,
                source=extract.source,
                cookie=extract.cookie,
                proxy=extract.proxy,
                cursor=extract.cursor,
                count=extract.count,
            ):
                return self.success_response(extract, data)
            return self.failed_response(extract)

        @self.server.post(
            "/douyin/live",
            summary=_("获取直播数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **web_rid**: 抖音直播 web_rid
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_live(extract: Live, token: str = Depends(token_dependency)):
            # if self.check_live_params(
            #     extract.web_rid,
            #     extract.room_id,
            #     extract.sec_user_id,
            # ):
            #     if data := await self.handle_live(
            #         extract,
            #     ):
            #         return self.success_response(extract, data[0])
            #     return self.failed_response(extract)
            # return DataResponse(
            #     message=_("参数错误！"),
            #     data=None,
            #     params=extract.model_dump(),
            # )
            if data := await self.handle_live(
                extract,
            ):
                return self.success_response(extract, data[0])
            return self.failed_response(extract)

        @self.server.post(
            "/douyin/comment",
            summary=_("获取作品评论数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **detail_id**: 抖音作品 ID；必需参数
                - **pages**: 最大请求次数；可选参数
                - **cursor**: 可选参数
                - **count**: 可选参数
                - **count_reply**: 可选参数
                - **reply**: 可选参数，默认值：False
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_comment(
            extract: Comment, token: str = Depends(token_dependency)
        ):
            if data := await self.comment_handle_single(
                extract.detail_id,
                cookie=extract.cookie,
                proxy=extract.proxy,
                source=extract.source,
                pages=extract.pages,
                cursor=extract.cursor,
                count=extract.count,
                count_reply=extract.count_reply,
                reply=extract.reply,
            ):
                return self.success_response(extract, data)
            return self.failed_response(extract)

        @self.server.post(
            "/douyin/reply",
            summary=_("获取评论回复数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **detail_id**: 抖音作品 ID；必需参数
                - **comment_id**: 评论 ID；必需参数
                - **pages**: 最大请求次数；可选参数
                - **cursor**: 可选参数
                - **count**: 可选参数
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_reply(extract: Reply, token: str = Depends(token_dependency)):
            if data := await self.reply_handle(
                extract.detail_id,
                extract.comment_id,
                cookie=extract.cookie,
                proxy=extract.proxy,
                pages=extract.pages,
                cursor=extract.cursor,
                count=extract.count,
                source=extract.source,
            ):
                return self.success_response(extract, data)
            return self.failed_response(extract)

        @self.server.post(
            "/douyin/search/general",
            summary=_("获取综合搜索数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **keyword**: 关键词；必需参数
                - **pages**: 总页数；可选参数
                - **sort_type**: 排序依据；可选参数
                - **publish_time**: 发布时间；可选参数
                - **duration**: 视频时长；可选参数
                - **search_range**: 搜索范围；可选参数
                - **content_type**: 内容形式；可选参数
                
                **部分参数传入规则请查阅文档**: [参数含义](https://github.com/JoeanAmier/TikTokDownloader/wiki/Documentation#%E9%87%87%E9%9B%86%E6%90%9C%E7%B4%A2%E7%BB%93%E6%9E%9C%E6%95%B0%E6%8D%AE%E6%8A%96%E9%9F%B3)
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_search_general(
            extract: GeneralSearch, token: str = Depends(token_dependency)
        ):
            return await self.handle_search(extract)

        @self.server.post(
            "/douyin/search/video",
            summary=_("获取视频搜索数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **keyword**: 关键词；必需参数
                - **pages**: 总页数；可选参数
                - **sort_type**: 排序依据；可选参数
                - **publish_time**: 发布时间；可选参数
                - **duration**: 视频时长；可选参数
                - **search_range**: 搜索范围；可选参数
                
                **部分参数传入规则请查阅文档**: [参数含义](https://github.com/JoeanAmier/TikTokDownloader/wiki/Documentation#%E9%87%87%E9%9B%86%E6%90%9C%E7%B4%A2%E7%BB%93%E6%9E%9C%E6%95%B0%E6%8D%AE%E6%8A%96%E9%9F%B3)
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_search_video(
            extract: VideoSearch, token: str = Depends(token_dependency)
        ):
            return await self.handle_search(extract)

        @self.server.post(
            "/douyin/search/user",
            summary=_("获取用户搜索数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **keyword**: 关键词；必需参数
                - **pages**: 总页数；可选参数
                - **douyin_user_fans**: 粉丝数量；可选参数
                - **douyin_user_type**: 用户类型；可选参数
                
                **部分参数传入规则请查阅文档**: [参数含义](https://github.com/JoeanAmier/TikTokDownloader/wiki/Documentation#%E9%87%87%E9%9B%86%E6%90%9C%E7%B4%A2%E7%BB%93%E6%9E%9C%E6%95%B0%E6%8D%AE%E6%8A%96%E9%9F%B3)
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_search_user(
            extract: UserSearch, token: str = Depends(token_dependency)
        ):
            return await self.handle_search(extract)

        @self.server.post(
            "/douyin/search/live",
            summary=_("获取直播搜索数据"),
            description=_(
                dedent("""
                **参数**:
                
                - **cookie**: 抖音 Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **keyword**: 关键词；必需参数
                - **pages**: 总页数；可选参数
                """)
            ),
            tags=[_("抖音")],
            response_model=DataResponse,
        )
        async def handle_search_live(
            extract: LiveSearch, token: str = Depends(token_dependency)
        ):
            return await self.handle_search(extract)

        @self.server.post(
            "/tiktok/share",
            summary=_("获取分享链接重定向的完整链接"),
            description=_(
                dedent("""
            **参数**:

            - **text**: 包含分享链接的字符串；必需参数
            - **proxy**: 代理；可选参数
            """)
            ),
            tags=["TikTok"],
            response_model=UrlResponse,
        )
        async def handle_share_tiktok(
            extract: ShortUrl, token: str = Depends(token_dependency)
        ):
            if url := await self.handle_redirect_tiktok(extract.text, extract.proxy):
                return UrlResponse(
                    message=_("请求链接成功！"),
                    url=url,
                    params=extract.model_dump(),
                )
            return UrlResponse(
                message=_("请求链接失败！"),
                url=None,
                params=extract.model_dump(),
            )

        @self.server.post(
            "/tiktok/detail",
            summary=_("获取单个作品数据"),
            description=_(
                dedent("""
                **参数**:

                - **cookie**: TikTok Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **detail_id**: TikTok 作品 ID；必需参数
                """)
            ),
            tags=["TikTok"],
            response_model=DataResponse,
        )
        async def handle_detail_tiktok(
            extract: DetailTikTok, token: str = Depends(token_dependency)
        ):
            return await self.handle_detail(extract, True)

        @self.server.post(
            "/tiktok/account",
            summary=_("获取账号作品数据"),
            description=_(
                dedent("""
                **参数**:

                - **cookie**: TikTok Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **sec_user_id**: TikTok 账号 secUid；必需参数
                - **tab**: 账号页面类型；可选参数，默认值：`post`
                - **earliest**: 作品最早发布日期；可选参数
                - **latest**: 作品最晚发布日期；可选参数
                - **pages**: 最大请求次数，仅对请求账号喜欢页数据有效；可选参数
                - **cursor**: 可选参数
                - **count**: 可选参数
                """)
            ),
            tags=["TikTok"],
            response_model=DataResponse,
        )
        async def handle_account_tiktok(
            extract: AccountTiktok, token: str = Depends(token_dependency)
        ):
            return await self.handle_account(extract, True)

        @self.server.post(
            "/tiktok/mix",
            summary=_("获取合辑作品数据"),
            description=_(
                dedent("""
                **参数**:

                - **cookie**: TikTok Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **mix_id**: TikTok 合集 ID；必需参数
                - **cursor**: 可选参数
                - **count**: 可选参数
                """)
            ),
            tags=["TikTok"],
            response_model=DataResponse,
        )
        async def handle_mix_tiktok(
            extract: MixTikTok, token: str = Depends(token_dependency)
        ):
            if data := await self.deal_mix_detail(
                True,
                extract.mix_id,
                api=True,
                source=extract.source,
                cookie=extract.cookie,
                proxy=extract.proxy,
                cursor=extract.cursor,
                count=extract.count,
            ):
                return self.success_response(extract, data)
            return self.failed_response(extract)

        @self.server.post(
            "/tiktok/live",
            summary=_("获取直播数据"),
            description=_(
                dedent("""
                **参数**:

                - **cookie**: TikTok Cookie；可选参数
                - **proxy**: 代理；可选参数
                - **source**: 是否返回原始响应数据；可选参数，默认值：False
                - **room_id**: TikTok 直播 room_id；必需参数
                """)
            ),
            tags=["TikTok"],
            response_model=DataResponse,
        )
        async def handle_live_tiktok(
            extract: Live, token: str = Depends(token_dependency)
        ):
            if data := await self.handle_live(
                extract,
                True,
            ):
                return self.success_response(extract, data[0])
            return self.failed_response(extract)

        # 添加实际下载文件的API端点
        @self.server.post(
            "/download/file",
            summary=_("下载文件到服务器"),
            description=_(
                dedent("""
                下载文件到服务器的Volume/Download/目录
                
                **参数说明:**
                - **url**: 文件下载链接；必需参数
                - **filename**: 文件名；可选参数，默认从URL提取
                - **platform**: 平台类型（douyin/tiktok）；可选参数，用于分类存储
                - **title**: 作品标题；可选参数，用于文件命名
                - **author**: 作者名；可选参数，用于文件命名
                """)
            ),
            tags=[_("下载")],
            response_model=dict,
        )
        async def download_file(
            url: str = Form(...),
            filename: str = Form(None),
            platform: str = Form("douyin"), 
            title: str = Form(None),
            author: str = Form(None),
            token: str = Depends(token_dependency)
        ):
            try:
                import asyncio
                import aiofiles
                from pathlib import Path
                
                # 设置下载路径
                download_root = self.parameter.root / "Download" / platform
                download_root.mkdir(parents=True, exist_ok=True)
                
                # 生成文件名
                if not filename:
                    if title and author:
                        # 清理文件名中的非法字符
                        clean_title = self.parameter.CLEANER.filter_name(title)[:50]
                        clean_author = self.parameter.CLEANER.filter_name(author)[:20]
                        timestamp = str(int(time()))
                        filename = f"{clean_author}_{clean_title}_{timestamp}"
                    else:
                        filename = f"download_{int(time())}"
                
                # 确定文件扩展名
                if "mp4" in url.lower() or "video" in url.lower():
                    file_extension = ".mp4"
                elif "jpg" in url.lower() or "jpeg" in url.lower():
                    file_extension = ".jpg"
                elif "png" in url.lower():
                    file_extension = ".png"
                else:
                    file_extension = ".mp4"  # 默认视频格式
                
                file_path = download_root / f"{filename}{file_extension}"
                
                # 使用httpx下载文件，添加必要的请求头
                import httpx
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'https://www.douyin.com/',
                    'Accept': '*/*',
                }
                async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
                    response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    async with aiofiles.open(file_path, 'wb') as f:
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            await f.write(chunk)
                    
                    return {
                        "message": "文件下载成功！",
                        "success": True,
                        "file_path": str(file_path),
                        "download_path": str(download_root),
                        "filename": f"{filename}{file_extension}"
                    }
                else:
                    return {
                        "message": f"下载失败，HTTP状态码: {response.status_code}",
                        "success": False,
                        "error": f"HTTP {response.status_code}"
                    }
                    
            except Exception as e:
                return {
                    "message": f"下载过程中出错: {str(e)}",
                    "success": False,
                    "error": str(e)
                }

        # 添加检查文件是否已下载的API端点
        @self.server.post(
            "/check/downloaded",
            summary=_("检查文件是否已下载"),
            description=_(
                dedent("""
                检查指定的文件是否已经下载到服务器
                
                **参数说明:**
                - **title**: 作品标题；必需参数
                - **author**: 作者名；必需参数
                - **platform**: 平台类型（douyin/tiktok）；可选参数
                """)
            ),
            tags=[_("下载")],
            response_model=dict,
        )
        async def check_downloaded(
            title: str = Form(...),
            author: str = Form(...),
            platform: str = Form("douyin"),
            token: str = Depends(token_dependency)
        ):
            try:
                # 设置下载路径
                download_root = self.parameter.root / "Download" / platform
                
                if not download_root.exists():
                    return {"downloaded": False, "files": []}
                
                # 生成可能的文件名模式
                clean_title = self.parameter.CLEANER.filter_name(title)[:50]
                clean_author = self.parameter.CLEANER.filter_name(author)[:20]
                
                # 查找匹配的文件
                found_files = []
                for file_path in download_root.glob("*"):
                    if file_path.is_file():
                        filename = file_path.stem
                        # 检查文件名是否包含作者和标题
                        if clean_author in filename and clean_title in filename:
                            found_files.append({
                                "filename": file_path.name,
                                "path": str(file_path),
                                "size": file_path.stat().st_size,
                                "created": file_path.stat().st_ctime
                            })
                
                return {
                    "downloaded": len(found_files) > 0,
                    "files": found_files,
                    "count": len(found_files)
                }
                    
            except Exception as e:
                return {
                    "downloaded": False,
                    "files": [],
                    "error": str(e)
                }

        # 添加从服务器下载文件到本地的API端点
        @self.server.get(
            "/download/local/{platform}/{filename}",
            summary=_("下载服务器文件到本地"),
            description=_(
                dedent("""
                将服务器上的文件下载到用户本地
                
                **参数说明:**
                - **platform**: 平台类型（douyin/tiktok）
                - **filename**: 文件名
                """)
            ),
            tags=[_("下载")],
        )
        async def download_to_local(
            platform: str,
            filename: str
        ):
            try:
                # 构建文件路径
                file_path = self.parameter.root / "Download" / platform / filename
                
                if not file_path.exists():
                    raise HTTPException(status_code=404, detail="文件不存在")
                
                # 返回文件下载响应
                return FileResponse(
                    path=str(file_path),
                    filename=filename,
                    media_type='application/octet-stream'
                )
                    
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

        @self.server.post(
            "/record/live",
            summary=_("录制直播到服务器"),
            description=_(
                dedent("""
                使用FFmpeg录制直播流到服务器
                
                **参数说明:**
                - **stream_url**: 直播流地址；必需参数
                - **streamer_name**: 主播名称；可选参数，用于文件命名
                - **platform**: 平台类型（douyin/tiktok）；可选参数
                - **duration**: 录制时长（分钟）；可选参数，默认10分钟
                """)
            ),
            tags=[_("直播")],
            response_model=dict,
        )
        async def record_live_stream(
            stream_url: str = Form(...),
            streamer_name: str = Form("unknown"),
            platform: str = Form("douyin"),
            duration: int = Form(0),  # 0表示智能录制，直到直播结束
            quality: str = Form("copy"),  # copy/high/medium/low
            token: str = Depends(token_dependency)
        ):
            try:
                import subprocess
                import asyncio
                import os
                import json
                from pathlib import Path
                from time import time
                
                # 设置录制路径
                record_root = self.parameter.root / "Download" / platform / "live_records"
                record_root.mkdir(parents=True, exist_ok=True)
                
                # 生成文件名
                clean_streamer = self.parameter.CLEANER.filter_name(streamer_name)[:20]
                timestamp = str(int(time()))
                filename = f"{clean_streamer}_live_{timestamp}.mp4"
                file_path = record_root / filename
                
                # 检查FFmpeg是否可用
                try:
                    subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
                except (subprocess.CalledProcessError, FileNotFoundError):
                    return {
                        "success": False,
                        "message": "FFmpeg未安装或不可用",
                        "error": "FFmpeg not found"
                    }
                
                # 根据质量参数构建FFmpeg命令
                base_cmd = ['ffmpeg', '-i', stream_url]
                
                # 智能录制：不设置时长限制，直到流结束
                if duration == 0:
                    # 智能录制模式：添加重连和错误处理
                    base_cmd.extend([
                        '-reconnect', '1',
                        '-reconnect_at_eof', '1',
                        '-reconnect_streamed', '1',
                        '-reconnect_delay_max', '10'
                    ])
                else:
                    # 手动设置时长
                    base_cmd.extend(['-t', str(duration * 60)])
                
                if quality == "copy":
                    # 流复制模式（默认，最快，无损）
                    ffmpeg_cmd = base_cmd + [
                        '-c', 'copy',
                        '-avoid_negative_ts', 'make_zero',
                        '-movflags', '+faststart',  # 优化MP4结构
                        '-f', 'mp4',
                        str(file_path)
                    ]
                elif quality == "high":
                    # 高质量转码
                    ffmpeg_cmd = base_cmd + [
                        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
                        '-c:a', 'aac', '-b:a', '128k',
                        '-avoid_negative_ts', 'make_zero',
                        '-movflags', '+faststart',
                        '-f', 'mp4',
                        str(file_path)
                    ]
                elif quality == "medium":
                    # 中等质量转码
                    ffmpeg_cmd = base_cmd + [
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
                        '-c:a', 'aac', '-b:a', '96k',
                        '-avoid_negative_ts', 'make_zero',
                        '-movflags', '+faststart',
                        '-f', 'mp4',
                        str(file_path)
                    ]
                else:  # low
                    # 低质量转码（节省空间）
                    ffmpeg_cmd = base_cmd + [
                        '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
                        '-c:a', 'aac', '-b:a', '64k',
                        '-s', '854x480',  # 降低分辨率
                        '-avoid_negative_ts', 'make_zero',
                        '-movflags', '+faststart',
                        '-f', 'mp4',
                        str(file_path)
                    ]
                
                # 检查并发录制限制
                max_concurrent_recordings = 5  # 最大同时录制数
                current_recordings = len([proc for proc in psutil.process_iter(['pid', 'name', 'cmdline']) 
                                        if proc.info['name'] == 'ffmpeg' and 'live_records' in ' '.join(proc.info['cmdline'])])
                
                if current_recordings >= max_concurrent_recordings:
                    return {
                        "success": False,
                        "message": f"已达到最大并发录制数限制({max_concurrent_recordings})，请等待其他录制完成",
                        "error": "concurrent_limit_reached"
                    }
                
                # 在后台启动录制进程，添加更多元数据
                env = os.environ.copy()
                env['RECORDING_STREAMER'] = clean_streamer
                env['RECORDING_PLATFORM'] = platform
                env['RECORDING_START_TIME'] = str(int(time()))
                
                process = subprocess.Popen(
                    ffmpeg_cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    cwd=str(record_root),
                    env=env
                )
                
                # 创建录制任务元数据文件
                metadata_file = record_root / f".{filename}.metadata"
                metadata = {
                    "streamer_name": clean_streamer,
                    "platform": platform,
                    "start_time": int(time()),
                    "process_id": process.pid,
                    "stream_url": stream_url,
                    "quality": quality,
                    "duration": duration,
                    "status": "recording"
                }
                
                import json
                with open(metadata_file, 'w', encoding='utf-8') as f:
                    json.dump(metadata, f, ensure_ascii=False, indent=2)
                
                return {
                    "success": True,
                    "message": f"开始录制直播 ({current_recordings + 1}/{max_concurrent_recordings})",
                    "file_path": str(file_path),
                    "record_path": str(record_root),
                    "filename": filename,
                    "duration": duration,
                    "process_id": process.pid,
                    "concurrent_count": current_recordings + 1,
                    "max_concurrent": max_concurrent_recordings,
                    "metadata_file": str(metadata_file)
                }
                    
            except Exception as e:
                return {
                    "success": False,
                    "message": f"录制启动失败: {str(e)}",
                    "error": str(e)
                }

        @self.server.get(
            "/record/status",
            summary=_("获取录制状态"),
            description=_(
                dedent("""
                获取当前所有录制任务的状态信息
                
                **返回信息:**
                - 正在录制的任务列表
                - 已完成的录制文件列表
                - 录制进度和剩余时间
                """)
            ),
            tags=[_("直播")],
            response_model=dict,
        )
        async def get_record_status(
            token: str = Depends(token_dependency)
        ):
            try:
                import psutil
                from pathlib import Path
                
                # 获取录制目录
                douyin_records = self.parameter.root / "Download" / "douyin" / "live_records"
                tiktok_records = self.parameter.root / "Download" / "tiktok" / "live_records"
                
                recording_tasks = []
                completed_files = []
                
                # 检查正在运行的FFmpeg进程并读取元数据
                for proc in psutil.process_iter(['pid', 'name', 'cmdline', 'create_time']):
                    try:
                        if proc.info['name'] == 'ffmpeg' and proc.info['cmdline']:
                            cmdline = ' '.join(proc.info['cmdline'])
                            if 'live_records' in cmdline:
                                # 解析命令行获取信息
                                cmd_parts = proc.info['cmdline']
                                
                                # 查找输出文件路径
                                output_file = None
                                duration = 0
                                for i, part in enumerate(cmd_parts):
                                    if part == '-t' and i + 1 < len(cmd_parts):
                                        duration = int(cmd_parts[i + 1]) // 60  # 转换为分钟
                                    elif part.endswith('.mp4') and 'live_records' in part:
                                        output_file = part
                                
                                if output_file:
                                    file_path = Path(output_file)
                                    elapsed_time = time() - proc.info['create_time']
                                    
                                    # 尝试读取元数据文件获取更多信息
                                    metadata_file = file_path.parent / f".{file_path.name}.metadata"
                                    metadata = {}
                                    if metadata_file.exists():
                                        try:
                                            with open(metadata_file, 'r', encoding='utf-8') as f:
                                                metadata = json.load(f)
                                        except:
                                            pass
                                    
                                    # 智能录制（duration=0）的进度计算
                                    if duration == 0:
                                        # 智能模式：显示已录制时间，无剩余时间
                                        remaining_time = 0
                                        progress = 0  # 智能模式无法计算进度百分比
                                        status_text = "智能录制中"
                                    else:
                                        remaining_time = max(0, (duration * 60) - elapsed_time)
                                        progress = min(100, (elapsed_time / (duration * 60)) * 100)
                                        status_text = "定时录制中"
                                    
                                    recording_tasks.append({
                                        'pid': proc.info['pid'],
                                        'filename': file_path.name,
                                        'file_path': str(file_path),
                                        'duration': duration,
                                        'elapsed_minutes': int(elapsed_time // 60),
                                        'elapsed_seconds': int(elapsed_time % 60),
                                        'remaining_minutes': int(remaining_time // 60),
                                        'remaining_seconds': int(remaining_time % 60),
                                        'progress': progress,
                                        'status': 'recording',
                                        'status_text': status_text,
                                        'streamer_name': metadata.get('streamer_name', '未知'),
                                        'platform': metadata.get('platform', '未知'),
                                        'quality': metadata.get('quality', 'copy'),
                                        'start_time': metadata.get('start_time', proc.info['create_time']),
                                        'stream_url': metadata.get('stream_url', ''),
                                        'is_smart_recording': duration == 0
                                    })
                    except (psutil.NoSuchProcess, psutil.AccessDenied, IndexError, json.JSONDecodeError):
                        continue
                
                # 获取已完成的录制文件
                for record_dir in [douyin_records, tiktok_records]:
                    if record_dir.exists():
                        platform = record_dir.parent.name
                        for file_path in record_dir.glob("*.mp4"):
                            if file_path.is_file():
                                stat = file_path.stat()
                                
                                # 尝试读取对应的metadata文件获取主播名等信息
                                metadata_file = file_path.parent / f".{file_path.name}.metadata"
                                metadata = {}
                                if metadata_file.exists():
                                    try:
                                        with open(metadata_file, 'r', encoding='utf-8') as f:
                                            metadata = json.load(f)
                                    except:
                                        pass
                                
                                # 如果metadata中没有主播名，则从文件名提取
                                streamer_name = metadata.get('streamer_name')
                                if not streamer_name:
                                    # 从文件名中提取主播名（去掉_live_和时间戳部分）
                                    streamer_name = file_path.name.replace('_live_', '_SPLIT_').split('_SPLIT_')[0] if '_live_' in file_path.name else file_path.stem
                                
                                completed_files.append({
                                    'filename': file_path.name,
                                    'file_path': str(file_path),
                                    'platform': platform,
                                    'size': stat.st_size,
                                    'size_mb': round(stat.st_size / 1024 / 1024, 2),
                                    'created_time': stat.st_ctime,
                                    'modified_time': stat.st_mtime,
                                    'status': 'completed',
                                    'streamer_name': streamer_name,
                                    'quality': metadata.get('quality', 'unknown'),
                                    'stream_url': metadata.get('stream_url', ''),
                                    'start_time': metadata.get('start_time', stat.st_ctime)
                                })
                
                # 按创建时间排序
                completed_files.sort(key=lambda x: x['created_time'], reverse=True)
                
                return {
                    "success": True,
                    "recording_tasks": recording_tasks,
                    "completed_files": completed_files,
                    "total_recording": len(recording_tasks),
                    "total_completed": len(completed_files)
                }
                    
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e),
                    "recording_tasks": [],
                    "completed_files": []
                }

        @self.server.get(
            "/storage/stats",
            summary=_("获取存储统计信息"),
            description=_(
                dedent("""
                获取下载目录的存储统计信息
                
                **返回信息:**
                - 总文件数和大小
                - 各平台文件分布
                - 文件类型统计
                """)
            ),
            tags=[_("存储")],
            response_model=dict,
        )
        async def get_storage_stats(
            token: str = Depends(token_dependency)
        ):
            try:
                import os
                from pathlib import Path
                
                # 获取下载目录
                download_root = self.parameter.root / "Download"
                douyin_dir = download_root / "douyin"
                tiktok_dir = download_root / "tiktok"
                
                stats = {
                    "server_path": str(download_root),
                    "total_files": 0,
                    "total_size": 0,
                    "video_files": 0,
                    "image_files": 0,
                    "platforms": {
                        "douyin": {"files": 0, "size": 0, "videos": 0, "images": 0},
                        "tiktok": {"files": 0, "size": 0, "videos": 0, "images": 0}
                    }
                }
                
                # 支持的文件类型
                video_extensions = {'.mp4', '.avi', '.mov', '.mkv', '.flv', '.webm'}
                image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'}
                
                # 统计各平台文件
                for platform_name, platform_dir in [("douyin", douyin_dir), ("tiktok", tiktok_dir)]:
                    if platform_dir.exists():
                        for file_path in platform_dir.rglob("*"):
                            if file_path.is_file() and not file_path.name.startswith('.'):
                                file_ext = file_path.suffix.lower()
                                file_size = file_path.stat().st_size
                                
                                # 更新总计
                                stats["total_files"] += 1
                                stats["total_size"] += file_size
                                
                                # 更新平台统计
                                stats["platforms"][platform_name]["files"] += 1
                                stats["platforms"][platform_name]["size"] += file_size
                                
                                # 分类文件类型
                                if file_ext in video_extensions:
                                    stats["video_files"] += 1
                                    stats["platforms"][platform_name]["videos"] += 1
                                elif file_ext in image_extensions:
                                    stats["image_files"] += 1
                                    stats["platforms"][platform_name]["images"] += 1
                
                # 格式化大小
                def format_size(size_bytes):
                    if size_bytes < 1024:
                        return f"{size_bytes} B"
                    elif size_bytes < 1024 * 1024:
                        return f"{size_bytes / 1024:.1f} KB"
                    elif size_bytes < 1024 * 1024 * 1024:
                        return f"{size_bytes / (1024 * 1024):.1f} MB"
                    else:
                        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
                
                # 添加格式化的大小字符串
                stats["total_size_formatted"] = format_size(stats["total_size"])
                stats["platforms"]["douyin"]["size_formatted"] = format_size(stats["platforms"]["douyin"]["size"])
                stats["platforms"]["tiktok"]["size_formatted"] = format_size(stats["platforms"]["tiktok"]["size"])
                
                return {
                    "success": True,
                    "data": stats
                }
                
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }

        @self.server.delete(
            "/storage/file",
            summary=_("删除录制文件"),
            description=_(
                dedent("""
                删除指定的录制文件和相关元数据
                
                **参数说明:**
                - **platform**: 平台名称 (douyin/tiktok)
                - **filename**: 文件名
                
                **功能:**
                - 删除服务器上的文件
                - 删除相关的元数据文件
                - 返回删除结果
                """)
            ),
            tags=[_("存储")],
            response_model=dict,
        )
        async def delete_storage_file(
            platform: str = Form(...),
            filename: str = Form(...)
        ):
            try:
                from pathlib import Path
                
                # 获取下载目录
                download_root = self.parameter.root / "Download"
                platform_dir = download_root / platform / "live_records"
                
                if not platform_dir.exists():
                    return {
                        "success": False,
                        "error": f"平台目录不存在: {platform}"
                    }
                
                # 文件路径
                file_path = platform_dir / filename
                metadata_file = platform_dir / f".{filename}.metadata"
                
                # 检查文件是否存在
                if not file_path.exists():
                    return {
                        "success": False,
                        "error": f"文件不存在: {filename}"
                    }
                
                deleted_files = []
                
                # 删除主文件
                try:
                    file_path.unlink()
                    deleted_files.append(filename)
                except Exception as e:
                    return {
                        "success": False,
                        "error": f"删除文件失败: {str(e)}"
                    }
                
                # 删除元数据文件（如果存在）
                if metadata_file.exists():
                    try:
                        metadata_file.unlink()
                        deleted_files.append(f".{filename}.metadata")
                    except Exception as e:
                        # 元数据删除失败不影响主文件删除结果
                        pass
                
                return {
                    "success": True,
                    "message": f"成功删除文件: {filename}",
                    "deleted_files": deleted_files
                }
                
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }

        @self.server.post(
            "/record/stop",
            summary=_("停止指定录制任务"),
            description=_(
                dedent("""
                精确停止指定的录制任务，不影响其他录制
                
                **参数说明:**
                - **process_id**: 进程ID；必需参数
                - **streamer_name**: 主播名称；可选参数，用于验证
                """)
            ),
            tags=[_("直播")],
            response_model=dict,
        )
        async def stop_recording(
            process_id: int = Form(...),
            streamer_name: str = Form(None),
            token: str = Depends(token_dependency)
        ):
            try:
                import psutil
                import signal
                from pathlib import Path
                
                # 查找并验证进程
                target_process = None
                try:
                    target_process = psutil.Process(process_id)
                    
                    # 验证是否为FFmpeg录制进程
                    if target_process.name() != 'ffmpeg':
                        return {
                            "success": False,
                            "message": f"进程 {process_id} 不是FFmpeg进程",
                            "error": "invalid_process"
                        }
                    
                    cmdline = ' '.join(target_process.cmdline())
                    if 'live_records' not in cmdline:
                        return {
                            "success": False,
                            "message": f"进程 {process_id} 不是直播录制进程",
                            "error": "not_recording_process"
                        }
                    
                    # 获取输出文件路径用于清理元数据
                    output_file = None
                    for part in target_process.cmdline():
                        if part.endswith('.mp4') and 'live_records' in part:
                            output_file = Path(part)
                            break
                    
                except psutil.NoSuchProcess:
                    return {
                        "success": False,
                        "message": f"进程 {process_id} 不存在，可能已经停止",
                        "error": "process_not_found"
                    }
                
                # 优雅停止进程
                try:
                    target_process.send_signal(signal.SIGTERM)
                    
                    # 等待进程优雅退出
                    try:
                        target_process.wait(timeout=10)
                        stop_method = "优雅停止"
                    except psutil.TimeoutExpired:
                        # 如果10秒后还没退出，强制终止
                        target_process.kill()
                        target_process.wait(timeout=5)
                        stop_method = "强制停止"
                        
                except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                    return {
                        "success": False,
                        "message": f"停止进程失败: {str(e)}",
                        "error": "stop_failed"
                    }
                
                # 清理元数据文件
                if output_file:
                    metadata_file = output_file.parent / f".{output_file.name}.metadata"
                    if metadata_file.exists():
                        try:
                            # 更新元数据状态为已停止
                            with open(metadata_file, 'r', encoding='utf-8') as f:
                                metadata = json.load(f)
                            metadata['status'] = 'stopped'
                            metadata['stop_time'] = int(time())
                            metadata['stop_method'] = stop_method
                            with open(metadata_file, 'w', encoding='utf-8') as f:
                                json.dump(metadata, f, ensure_ascii=False, indent=2)
                        except:
                            pass
                
                return {
                    "success": True,
                    "message": f"录制任务已停止 (PID: {process_id})",
                    "process_id": process_id,
                    "stop_method": stop_method,
                    "output_file": str(output_file) if output_file else None
                }
                    
            except Exception as e:
                return {
                    "success": False,
                    "message": f"停止录制失败: {str(e)}",
                    "error": str(e)
                }

        @self.server.post(
            "/settings/cookie",
            summary=_("保存全局Cookie设置"),
            description=_(
                dedent("""
                保存全局Cookie到服务器配置文件
                
                **参数说明:**
                - **douyin_cookie**: 抖音Cookie；可选参数
                - **tiktok_cookie**: TikTok Cookie；可选参数
                """)
            ),
            tags=[_("设置")],
            response_model=dict,
        )
        async def save_global_cookies(
            douyin_cookie: str = Form(""),
            tiktok_cookie: str = Form(""),
            token: str = Depends(token_dependency)
        ):
            try:
                import json
                from pathlib import Path
                
                # 配置文件路径
                config_file = self.parameter.root / "config" / "cookies.json"
                config_file.parent.mkdir(parents=True, exist_ok=True)
                
                # 读取现有配置
                config = {}
                if config_file.exists():
                    try:
                        with open(config_file, 'r', encoding='utf-8') as f:
                            config = json.load(f)
                    except:
                        pass
                
                # 更新配置
                if douyin_cookie:
                    config['douyin_cookie'] = douyin_cookie
                if tiktok_cookie:
                    config['tiktok_cookie'] = tiktok_cookie
                
                config['updated_time'] = int(time())
                
                # 保存配置
                with open(config_file, 'w', encoding='utf-8') as f:
                    json.dump(config, f, ensure_ascii=False, indent=2)
                
                return {
                    "success": True,
                    "message": "全局Cookie已保存到服务器",
                    "config_file": str(config_file),
                    "douyin_saved": bool(douyin_cookie),
                    "tiktok_saved": bool(tiktok_cookie)
                }
                    
            except Exception as e:
                return {
                    "success": False,
                    "message": f"保存Cookie失败: {str(e)}",
                    "error": str(e)
                }

        @self.server.get(
            "/settings/cookie",
            summary=_("获取全局Cookie设置"),
            description=_(
                dedent("""
                从服务器获取全局Cookie配置
                
                **返回信息:**
                - 抖音和TikTok的全局Cookie
                - 最后更新时间
                """)
            ),
            tags=[_("设置")],
            response_model=dict,
        )
        async def get_global_cookies(
            token: str = Depends(token_dependency)
        ):
            try:
                import json
                from pathlib import Path
                
                config_file = self.parameter.root / "config" / "cookies.json"
                
                if not config_file.exists():
                    return {
                        "success": True,
                        "douyin_cookie": "",
                        "tiktok_cookie": "",
                        "updated_time": 0,
                        "message": "暂无保存的Cookie配置"
                    }
                
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                return {
                    "success": True,
                    "douyin_cookie": config.get('douyin_cookie', ''),
                    "tiktok_cookie": config.get('tiktok_cookie', ''),
                    "updated_time": config.get('updated_time', 0),
                    "message": "Cookie配置获取成功"
                }
                    
            except Exception as e:
                return {
                    "success": False,
                    "message": f"获取Cookie失败: {str(e)}",
                    "error": str(e),
                    "douyin_cookie": "",
                    "tiktok_cookie": "",
                    "updated_time": 0
                }

        @self.server.post(
            "/settings/password",
            summary=_("设置访问密码"),
            description=_(
                dedent("""
                设置或更新设置页面访问密码
                
                **参数说明:**
                - **password**: 新密码
                - **old_password**: 旧密码（更新时需要）
                
                **安全说明:**
                - 密码使用SHA256加密存储
                - 首次设置无需旧密码
                """)
            ),
            tags=[_("设置")],
            response_model=dict,
        )
        async def set_settings_password(
            password: str = Form(...),
            old_password: str = Form(default="")
        ):
            try:
                import hashlib
                import json
                from datetime import datetime, timedelta
                
                config_dir = self.parameter.root / "config"
                config_dir.mkdir(exist_ok=True)
                password_file = config_dir / "access_password.json"
                
                # 如果文件存在且有旧密码验证
                if password_file.exists() and old_password:
                    try:
                        with open(password_file, 'r', encoding='utf-8') as f:
                            content = f.read().strip()
                            if not content:
                                # 空文件，删除并当作新设置
                                password_file.unlink()
                            else:
                                stored_data = json.loads(content)
                                # 验证旧密码
                                old_hash = hashlib.sha256(old_password.encode()).hexdigest()
                                if stored_data.get("password_hash") != old_hash:
                                    return {
                                        "success": False,
                                        "error": "旧密码验证失败"
                                    }
                    except (json.JSONDecodeError, Exception):
                        # JSON解析失败，删除损坏的文件
                        password_file.unlink()
                elif password_file.exists() and not old_password:
                    # 检查文件是否有效
                    try:
                        with open(password_file, 'r', encoding='utf-8') as f:
                            content = f.read().strip()
                            if content:
                                json.loads(content)  # 验证JSON格式
                                return {
                                    "success": False,
                                    "error": "修改密码需要提供旧密码"
                                }
                            else:
                                # 空文件，删除它
                                password_file.unlink()
                    except (json.JSONDecodeError, Exception):
                        # JSON解析失败，删除损坏的文件
                        password_file.unlink()
                
                # 加密新密码
                password_hash = hashlib.sha256(password.encode()).hexdigest()
                
                # 保存密码
                password_data = {
                    "password_hash": password_hash,
                    "create_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "update_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                
                with open(password_file, 'w', encoding='utf-8') as f:
                    json.dump(password_data, f, indent=2, ensure_ascii=False)
                
                return {
                    "success": True,
                    "message": "密码设置成功"
                }
                
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }

        @self.server.post(
            "/settings/verify",
            summary=_("验证访问密码"),
            description=_(
                dedent("""
                验证设置页面访问密码
                
                **参数说明:**
                - **password**: 访问密码
                
                **返回信息:**
                - 验证结果
                - 验证成功返回访问令牌
                """)
            ),
            tags=[_("设置")],
            response_model=dict,
        )
        async def verify_settings_password(
            password: str = Form(...)
        ):
            try:
                import hashlib
                import secrets
                import json
                from datetime import datetime, timedelta
                
                config_dir = self.parameter.root / "config"
                password_file = config_dir / "access_password.json"
                
                # 检查是否设置了密码
                if not password_file.exists():
                    return {
                        "success": False,
                        "error": "未设置访问密码",
                        "need_setup": True
                    }
                
                # 读取密码
                try:
                    with open(password_file, 'r', encoding='utf-8') as f:
                        content = f.read().strip()
                        if not content:
                            password_file.unlink()
                            return {
                                "success": False,
                                "error": "未设置访问密码",
                                "need_setup": True
                            }
                        stored_data = json.loads(content)
                except (json.JSONDecodeError, Exception):
                    password_file.unlink()
                    return {
                        "success": False,
                        "error": "未设置访问密码",
                        "need_setup": True
                    }
                
                # 验证密码
                password_hash = hashlib.sha256(password.encode()).hexdigest()
                if stored_data.get("password_hash") != password_hash:
                    return {
                        "success": False,
                        "error": "密码验证失败"
                    }
                
                # 生成访问令牌（24小时有效）
                access_token = secrets.token_urlsafe(32)
                token_data = {
                    "token": access_token,
                    "expire_time": (datetime.now() + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S"),
                    "create_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
                
                # 保存令牌
                token_file = config_dir / "access_tokens.json"
                if token_file.exists():
                    with open(token_file, 'r', encoding='utf-8') as f:
                        tokens = json.load(f)
                else:
                    tokens = {"tokens": []}
                
                # 清理过期令牌
                current_time = datetime.now()
                tokens["tokens"] = [
                    t for t in tokens.get("tokens", [])
                    if datetime.strptime(t["expire_time"], "%Y-%m-%d %H:%M:%S") > current_time
                ]
                
                # 添加新令牌
                tokens["tokens"].append(token_data)
                
                with open(token_file, 'w', encoding='utf-8') as f:
                    json.dump(tokens, f, indent=2, ensure_ascii=False)
                
                return {
                    "success": True,
                    "message": "验证成功",
                    "access_token": access_token,
                    "expire_time": token_data["expire_time"]
                }
                
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }

        @self.server.get(
            "/settings/password/status",
            summary=_("检查密码设置状态"),
            description=_(
                dedent("""
                检查是否已设置访问密码
                
                **返回信息:**
                - 是否已设置密码
                - 设置时间
                """)
            ),
            tags=[_("设置")],
            response_model=dict,
        )
        async def get_password_status():
            try:
                import json
                
                config_dir = self.parameter.root / "config"
                password_file = config_dir / "access_password.json"
                
                if password_file.exists():
                    try:
                        with open(password_file, 'r', encoding='utf-8') as f:
                            content = f.read().strip()
                            if content:
                                data = json.loads(content)
                                return {
                                    "success": True,
                                    "has_password": True,
                                    "create_time": data.get("create_time", ""),
                                    "update_time": data.get("update_time", "")
                                }
                            else:
                                # 文件存在但为空，删除它
                                password_file.unlink()
                                return {
                                    "success": True,
                                    "has_password": False
                                }
                    except (json.JSONDecodeError, Exception):
                        # JSON解析失败，删除损坏的文件
                        password_file.unlink()
                        return {
                            "success": True,
                            "has_password": False
                        }
                else:
                    return {
                        "success": True,
                        "has_password": False
                    }
                    
            except Exception as e:
                return {
                    "success": False,
                    "error": str(e)
                }

        @self.server.post(
            "/database/download_history",
            summary=_("保存下载历史到数据库"),
            description=_(
                dedent("""
                保存下载历史记录到SQLite数据库
                
                **参数说明:**
                - **title**: 作品标题；必需参数
                - **author**: 作者名；必需参数
                - **platform**: 平台类型；必需参数
                - **download_urls**: 下载链接（JSON格式）；必需参数
                - **download_type**: 下载类型；可选参数
                - **work_id**: 作品ID；可选参数
                """)
            ),
            tags=[_("数据库")],
            response_model=dict,
        )
        async def save_download_history(
            title: str = Form(...),
            author: str = Form(...),
            platform: str = Form(...),
            download_urls: str = Form(...),  # JSON字符串
            download_type: str = Form("single"),
            work_id: str = Form(None),
            thumbnail_url: str = Form(None),
            duration: str = Form(None),
            tags: str = Form(None),
            token: str = Depends(token_dependency)
        ):
            try:
                import sqlite3
                import json
                from pathlib import Path
                
                db_path = self.parameter.root / "DouK-Downloader.db"
                
                with sqlite3.connect(str(db_path)) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute("""
                        INSERT INTO download_history 
                        (title, author, platform, download_urls, download_type, work_id, 
                         thumbnail_url, duration, tags)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        title, author, platform, download_urls, download_type,
                        work_id, thumbnail_url, duration, tags
                    ))
                    
                    record_id = cursor.lastrowid
                    conn.commit()
                
                return {
                    "success": True,
                    "message": "下载历史已保存到数据库",
                    "record_id": record_id
                }
                    
            except Exception as e:
                return {
                    "success": False,
                    "message": f"保存下载历史失败: {str(e)}",
                    "error": str(e)
                }

        @self.server.get(
            "/database/download_history",
            summary=_("获取下载历史"),
            description=_(
                dedent("""
                从数据库获取下载历史记录
                
                **参数说明:**
                - **limit**: 返回记录数量限制
                - **offset**: 偏移量（分页）
                - **platform**: 平台过滤
                """)
            ),
            tags=[_("数据库")],
            response_model=dict,
        )
        async def get_download_history(
            limit: int = 50,
            offset: int = 0,
            platform: str = None,
            token: str = Depends(token_dependency)
        ):
            try:
                import sqlite3
                import json
                from pathlib import Path
                
                db_path = self.parameter.root / "DouK-Downloader.db"
                
                with sqlite3.connect(str(db_path)) as conn:
                    conn.row_factory = sqlite3.Row  # 使结果可以按列名访问
                    cursor = conn.cursor()
                    
                    # 构建查询条件
                    where_clause = ""
                    params = []
                    
                    if platform:
                        where_clause = "WHERE platform = ?"
                        params.append(platform)
                    
                    query = f"""
                        SELECT * FROM download_history 
                        {where_clause}
                        ORDER BY download_time DESC 
                        LIMIT ? OFFSET ?
                    """
                    params.extend([limit, offset])
                    
                    cursor.execute(query, params)
                    records = cursor.fetchall()
                    
                    # 获取总数
                    count_query = f"SELECT COUNT(*) as total FROM download_history {where_clause}"
                    cursor.execute(count_query, params[:-2] if platform else [])
                    total = cursor.fetchone()['total']
                    
                    # 转换为字典列表
                    history = []
                    for row in records:
                        record = dict(row)
                        # 解析JSON字段
                        try:
                            record['download_urls'] = json.loads(record['download_urls'])
                        except:
                            record['download_urls'] = []
                        try:
                            record['tags'] = json.loads(record['tags']) if record['tags'] else []
                        except:
                            record['tags'] = []
                        history.append(record)
                
                return {
                    "success": True,
                    "data": history,
                    "total": total,
                    "limit": limit,
                    "offset": offset
                }
                    
            except Exception as e:
                return {
                    "success": False,
                    "message": f"获取下载历史失败: {str(e)}",
                    "error": str(e),
                    "data": [],
                    "total": 0
                }

        @self.server.post(
            "/database/recording_history",
            summary=_("保存录制历史到数据库"),
            description=_(
                dedent("""
                保存录制历史记录到SQLite数据库
                """)
            ),
            tags=[_("数据库")],
            response_model=dict,
        )
        async def save_recording_history(
            streamer_name: str = Form(...),
            platform: str = Form(...),
            stream_url: str = Form(...),
            file_path: str = Form(...),
            file_name: str = Form(...),
            process_id: int = Form(None),
            quality: str = Form("copy"),
            metadata: str = Form(None),
            token: str = Depends(token_dependency)
        ):
            try:
                import sqlite3
                from pathlib import Path
                
                db_path = self.parameter.root / "DouK-Downloader.db"
                
                with sqlite3.connect(str(db_path)) as conn:
                    cursor = conn.cursor()
                    
                    cursor.execute("""
                        INSERT INTO recording_history 
                        (streamer_name, platform, stream_url, file_path, file_name, 
                         process_id, start_time, quality, metadata)
                        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
                    """, (
                        streamer_name, platform, stream_url, file_path, file_name,
                        process_id, quality, metadata
                    ))
                    
                    record_id = cursor.lastrowid
                    conn.commit()
                
                return {
                    "success": True,
                    "message": "录制历史已保存到数据库",
                    "record_id": record_id
                }
                    
            except Exception as e:
                return {
                    "success": False,
                    "message": f"保存录制历史失败: {str(e)}",
                    "error": str(e)
                }

        @self.server.get(
            "/database/recording_history",
            summary=_("获取录制历史"),
            description=_("从数据库获取录制历史记录"),
            tags=[_("数据库")],
            response_model=dict,
        )
        async def get_recording_history(
            limit: int = 50,
            offset: int = 0,
            status: str = None,
            token: str = Depends(token_dependency)
        ):
            try:
                import sqlite3
                from pathlib import Path
                
                db_path = self.parameter.root / "DouK-Downloader.db"
                
                with sqlite3.connect(str(db_path)) as conn:
                    conn.row_factory = sqlite3.Row
                    cursor = conn.cursor()
                    
                    where_clause = ""
                    params = []
                    
                    if status:
                        where_clause = "WHERE status = ?"
                        params.append(status)
                    
                    query = f"""
                        SELECT * FROM recording_history 
                        {where_clause}
                        ORDER BY start_time DESC 
                        LIMIT ? OFFSET ?
                    """
                    params.extend([limit, offset])
                    
                    cursor.execute(query, params)
                    records = cursor.fetchall()
                    
                    cursor.execute(f"SELECT COUNT(*) as total FROM recording_history {where_clause}", 
                                 params[:-2] if status else [])
                    total = cursor.fetchone()['total']
                    
                    history = [dict(row) for row in records]
                
                return {
                    "success": True,
                    "data": history,
                    "total": total,
                    "limit": limit,
                    "offset": offset
                }
                    
            except Exception as e:
                return {
                    "success": False,
                    "message": f"获取录制历史失败: {str(e)}",
                    "error": str(e),
                    "data": [],
                    "total": 0
                }

    async def handle_search(self, extract):
        if isinstance(
            data := await self.deal_search_data(
                extract,
                extract.source,
            ),
            list,
        ):
            return self.success_response(
                extract,
                *(data, None) if any(data) else (None, _("搜索结果为空！")),
            )
        return self.failed_response(extract)

    async def handle_detail(
        self,
        extract: Detail | DetailTikTok,
        tiktok=False,
    ):
        root, params, logger = self.record.run(self.parameter)
        async with logger(root, console=self.console, **params) as record:
            if data := await self._handle_detail(
                [extract.detail_id],
                tiktok,
                record,
                True,
                extract.source,
                extract.cookie,
                extract.proxy,
            ):
                return self.success_response(extract, data[0])
            return self.failed_response(extract)

    async def handle_account(
        self,
        extract: Account | AccountTiktok,
        tiktok=False,
    ):
        if data := await self.deal_account_detail(
            0,
            extract.sec_user_id,
            tab=extract.tab,
            earliest=extract.earliest,
            latest=extract.latest,
            pages=extract.pages,
            api=True,
            source=extract.source,
            cookie=extract.cookie,
            proxy=extract.proxy,
            tiktok=tiktok,
            cursor=extract.cursor,
            count=extract.count,
        ):
            return self.success_response(extract, data)
        return self.failed_response(extract)

    @staticmethod
    def success_response(
        extract,
        data: dict | list[dict],
        message: str = None,
    ):
        return DataResponse(
            message=message or _("获取数据成功！"),
            data=data,
            params=extract.model_dump(),
        )

    @staticmethod
    def failed_response(
        extract,
        message: str = None,
    ):
        return DataResponse(
            message=message or _("获取数据失败！"),
            data=None,
            params=extract.model_dump(),
        )

    @staticmethod
    def generate_mix_params(mix_id: str = None, detail_id: str = None):
        if mix_id:
            return True, mix_id
        return (False, detail_id) if detail_id else (None, None)

    @staticmethod
    def check_live_params(
        web_rid: str = None,
        room_id: str = None,
        sec_user_id: str = None,
    ) -> bool:
        return bool(web_rid or room_id and sec_user_id)

    async def handle_live(self, extract: Live | LiveTikTok, tiktok=False):
        if tiktok:
            data = await self.get_live_data_tiktok(
                extract.room_id,
                extract.cookie,
                extract.proxy,
            )
        else:
            data = await self.get_live_data(
                extract.web_rid,
                # extract.room_id,
                # extract.sec_user_id,
                cookie=extract.cookie,
                proxy=extract.proxy,
            )
        if extract.source:
            return [data]
        return await self.extractor.run(
            [data],
            None,
            "live",
            tiktok=tiktok,
        )

    def setup_static_files(self):
        """设置静态文件服务"""
        webui_dir = Path(__file__).parent.parent.parent / "webui"
        if webui_dir.exists():
            # 挂载静态文件目录
            self.server.mount("/webui", StaticFiles(directory=str(webui_dir)), name="webui")
