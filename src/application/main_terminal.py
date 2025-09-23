from datetime import date, datetime
from pathlib import Path
from platform import system
from time import time
from types import SimpleNamespace
from typing import TYPE_CHECKING, Any, Callable, Union

from pydantic import ValidationError

# from ..custom import failure_handling
from ..custom import suspend
from ..downloader import Downloader
from ..extract import Extractor
from ..interface import (
    API,
    Account,
    AccountTikTok,
    Collection,
    # CommentTikTok,
    Collects,
    CollectsDetail,
    CollectsMix,
    # CollectsSeries,
    CollectsMusic,
    Comment,
    Detail,
    DetailTikTok,
    HashTag,
    Hot,
    Info,
    InfoTikTok,
    Live,
    LiveTikTok,
    Mix,
    MixTikTok,
    Reply,
    Search,
    User,
)
from ..link import Extractor as LinkExtractor
from ..link import ExtractorTikTok
from ..manager import Cache
from ..models import (
    GeneralSearch,
    LiveSearch,
    UserSearch,
    VideoSearch,
)
from ..module import DetailTikTokExtractor, DetailTikTokUnofficial
from ..storage import RecordManager
from ..tools import DownloaderError, choose, safe_pop
from ..translation import _

if TYPE_CHECKING:
    from pydantic import BaseModel

    from ..config import Parameter
    from ..manager import Database

__all__ = [
    "TikTok",
]


def check_storage_format(function):
    async def inner(self, *args, **kwargs):
        if self.parameter.storage_format:
            return await function(self, *args, **kwargs)
        self.console.warning(
            _(
                "未设置 storage_format 参数，无法正常使用该功能，详细说明请查阅项目文档！"
            ),
        )

    return inner


def check_cookie_state(tiktok=False):
    def check_cookie(function):
        async def inner(self, *args, **kwargs):
            if tiktok:
                params = self.parameter.cookie_tiktok_state
                tip = "TikTok Cookie"
            else:
                params = self.parameter.cookie_state
                tip = _("抖音 Cookie")
            if params:
                return await function(self, *args, **kwargs)
            self.console.warning(
                _("{tip} 未登录，无法使用该功能，详细说明请查阅项目文档！").format(
                    tip=tip
                ),
            )

        return inner

    return check_cookie


class TikTok:
    ENCODE = "UTF-8-SIG" if system() == "Windows" else "UTF-8"

    def __init__(
        self,
        parameter: "Parameter",
        database: "Database",
        server_mode: bool = False,
    ):
        self.run_command = None
        self.parameter = parameter
        self.database = database
        self.console = parameter.console
        self.logger = parameter.logger
        API.init_progress_object(
            server_mode,
        )
        self.links = LinkExtractor(parameter)
        self.links_tiktok = ExtractorTikTok(parameter)
        self.downloader = Downloader(
            parameter,
            server_mode,
        )
        self.extractor = Extractor(parameter)
        self.storage = bool(parameter.storage_format)
        self.record = RecordManager()
        self.settings = parameter.settings
        self.accounts = parameter.accounts_urls
        self.accounts_tiktok = parameter.accounts_urls_tiktok
        self.mix = parameter.mix_urls
        self.mix_tiktok = parameter.mix_urls_tiktok
        self.owner = parameter.owner_url
        self.owner_tiktok = parameter.owner_url_tiktok
        self.running = True
        self.ffmpeg = parameter.ffmpeg.state
        self.cache = Cache(
            parameter,
            self.database,
            "mark" in parameter.name_format,
            "nickname" in parameter.name_format,
        )
        self.__function = (
            (
                _("批量下载账号作品(抖音)"),
                self.account_acquisition_interactive,
            ),
            (
                _("批量下载链接作品(抖音)"),
                self.detail_interactive,
            ),
            (
                _("获取直播推流地址(抖音)"),
                self.live_interactive,
            ),
            (
                _("采集作品评论数据(抖音)"),
                self.comment_interactive,
            ),
            (
                _("批量下载合集作品(抖音)"),
                self.mix_interactive,
            ),
            (
                _("采集账号详细数据(抖音)"),
                self.user_interactive,
            ),
            (
                _("采集搜索结果数据(抖音)"),
                self.search_interactive,
            ),
            (
                _("采集抖音热榜数据(抖音)"),
                self.hot_interactive,
            ),
            # (_("批量下载话题作品(抖音)"),),
            (
                _("批量下载收藏作品(抖音)"),
                self.collection_interactive,
            ),
            (
                _("批量下载收藏音乐(抖音)"),
                self.collection_music_interactive,
            ),
            # (_("批量下载收藏短剧(抖音)"),),
            (
                _("批量下载收藏夹作品(抖音)"),
                self.collects_interactive,
            ),
            (
                _("批量下载账号作品(TikTok)"),
                self.account_acquisition_interactive_tiktok,
            ),
            (
                _("批量下载链接作品(TikTok)"),
                self.detail_interactive_tiktok,
            ),
            (
                _("批量下载合集作品(TikTok)"),
                self.mix_interactive_tiktok,
            ),
            (
                _("获取直播推流地址(TikTok)"),
                self.live_interactive_tiktok,
            ),
            # (_("采集作品评论数据(TikTok)"), self.comment_interactive_tiktok,),
            (
                _("批量下载视频原画(TikTok)"),
                self.detail_interactive_tiktok_unofficial,
            ),
        )
        self.__function_account = (
            (_("使用 accounts_urls 参数的账号链接(推荐)"), self.account_detail_batch),
            (_("手动输入待采集的账号链接"), self.account_detail_inquire),
            (_("从文本文档读取待采集的账号链接"), self.account_detail_txt),
        )
        self.__function_account_tiktok = (
            (
                _("使用 accounts_urls_tiktok 参数的账号链接(推荐)"),
                self.account_detail_batch_tiktok,
            ),
            (_("手动输入待采集的账号链接"), self.account_detail_inquire_tiktok),
            (_("从文本文档读取待采集的账号链接"), self.account_detail_txt_tiktok),
        )
        self.__function_mix = (
            (_("使用 mix_urls 参数的合集链接(推荐)"), self.mix_batch),
            (_("获取当前账号收藏合集列表"), self.mix_collection),
            (_("手动输入待采集的合集/作品链接"), self.mix_inquire),
            (_("从文本文档读取待采集的合集/作品链接"), self.mix_txt),
        )
        self.__function_mix_tiktok = (
            (_("使用 mix_urls_tiktok 参数的合集链接(推荐)"), self.mix_batch_tiktok),
            (_("手动输入待采集的合集/作品链接"), self.mix_inquire_tiktok),
            (_("从文本文档读取待采集的合集/作品链接"), self.mix_txt_tiktok),
        )
        self.__function_user = (
            (_("使用 accounts_urls 参数的账号链接"), self.user_batch),
            (_("手动输入待采集的账号链接"), self.user_inquire),
            (_("从文本文档读取待采集的账号链接"), self.user_txt),
        )
        self.__function_detail = (
            (_("手动输入待采集的作品链接"), self.__detail_inquire),
            (_("从文本文档读取待采集的作品链接"), self.__detail_txt),
        )
        self.__function_detail_tiktok = (
            (_("手动输入待采集的作品链接"), self.__detail_inquire_tiktok),
            (_("从文本文档读取待采集的作品链接"), self.__detail_txt_tiktok),
        )
        self.__function_detail_tiktok_unofficial = (
            (_("手动输入待采集的作品链接"), self.__detail_inquire_tiktok_unofficial),
            (_("从文本文档读取待采集的作品链接"), self.__detail_txt_tiktok_unofficial),
        )
        self.__function_comment = (
            (_("手动输入待采集的作品链接"), self.__comment_inquire),
            (_("从文本文档读取待采集的作品链接"), self.__comment_txt),
        )
        self.__function_comment_tiktok = (
            (_("手动输入待采集的作品链接"), self.__comment_inquire_tiktok),
            # (_("从文本文档读取待采集的作品链接"), self.__comment_txt_tiktok),
        )
        self.__function_search = (
            (
                _("综合搜索数据采集"),
                self._search_interactive_general,
            ),
            (
                _("视频搜索数据采集"),
                self._search_interactive_video,
            ),
            (
                _("用户搜索数据采集"),
                self._search_interactive_user,
            ),
            (
                _("直播搜索数据采集"),
                self._search_interactive_live,
            ),
        )

    def _inquire_input(
        self,
        tip: str = "",
        problem: str = "",
    ) -> str:
        text = self.console.input(problem or _("请输入{tip}链接: ").format(tip=tip))
        if not text:
            return ""
        elif text.upper() == "Q":
            self.running = False
            return ""
        return text

    async def account_acquisition_interactive_tiktok(
        self,
        select="",
    ):
        await self.__secondary_menu(
            _("请选择账号链接来源"),
            function=self.__function_account_tiktok,
            select=select or safe_pop(self.run_command),
        )
        self.logger.info(_("已退出批量下载账号作品(TikTok)模式"))

    def __summarize_results(self, count: SimpleNamespace, name=_("账号")):
        time_ = time() - count.time
        self.logger.info(
            _(
                "程序共处理 {0} 个{1}，成功 {2} 个，失败 {3} 个，耗时 {4} 分钟 {5} 秒"
            ).format(
                count.success + count.failed,
                name,
                count.success,
                count.failed,
                int(time_ // 60),
                int(time_ % 60),
            )
        )

    async def account_acquisition_interactive(
        self,
        select="",
    ):
        await self.__secondary_menu(
            _("请选择账号链接来源"),
            function=self.__function_account,
            select=select or safe_pop(self.run_command),
        )
        self.logger.info(_("已退出批量下载账号作品(抖音)模式"))

    async def __secondary_menu(
        self,
        problem=_("请选择账号链接来源"),
        function=...,
        select: str | int = ...,
        *args,
        **kwargs,
    ):
        if not select:
            select = choose(
                problem,
                [i[0] for i in function],
                self.console,
            )
        if select.upper() == "Q":
            self.running = False
        try:
            n = int(select) - 1
        except ValueError:
            return
        if n in range(len(function)):
            await function[n][1](
                *args,
                **kwargs,
            )

    async def account_detail_batch(
        self,
        *args,
    ):
        await self.__account_detail_batch(
            self.accounts,
            "accounts_urls",
            False,
        )

    async def account_detail_batch_tiktok(
        self,
        *args,
    ):
        await self.__account_detail_batch(
            self.accounts_tiktok,
            "accounts_urls_tiktok",
            True,
        )

    async def __account_detail_batch(
        self,
        accounts: list[SimpleNamespace],
        params_name: str,
        tiktok: bool,
    ) -> None:
        count = SimpleNamespace(time=time(), success=0, failed=0)
        self.logger.info(
            _("共有 {count} 个账号的作品等待下载").format(count=len(accounts))
        )
        for index, data in enumerate(accounts, start=1):
            if not (
                sec_user_id := await self.check_sec_user_id(
                    data.url,
                    tiktok,
                )
            ):
                self.logger.warning(
                    _(
                        "配置文件 {name} 参数的 url {url} 提取 sec_user_id 失败，错误配置：{data}"
                    ).format(
                        name=params_name,
                        url=data.url,
                        data=vars(data),
                    )
                )
                count.failed += 1
                continue
            if not await self.deal_account_detail(
                index,
                **vars(data) | {"sec_user_id": sec_user_id},
                tiktok=tiktok,
            ):
                count.failed += 1
                continue
            # break  # 调试代码
            count.success += 1
            if index != len(accounts):
                await suspend(index, self.console)
        self.__summarize_results(
            count,
            _("账号"),
        )

    async def check_sec_user_id(
        self,
        sec_user_id: str,
        tiktok=False,
    ) -> str:
        match tiktok:
            case True:
                sec_user_id = await self.links_tiktok.run(sec_user_id, "user")
            case False:
                sec_user_id = await self.links.run(sec_user_id, "user")
        return sec_user_id[0] if len(sec_user_id) > 0 else ""

    async def account_detail_inquire(
        self,
        *args,
    ):
        while url := self._inquire_input(_("账号主页")):
            links = await self.links.run(url, "user")
            if not links:
                self.logger.warning(
                    _("{url} 提取账号 sec_user_id 失败").format(url=url)
                )
                continue
            await self.__account_detail_handle(
                links,
                False,
                *args,
            )

    async def account_detail_inquire_tiktok(
        self,
        *args,
    ):
        while url := self._inquire_input(_("账号主页")):
            links = await self.links_tiktok.run(url, "user")
            if not links:
                self.logger.warning(
                    _("{url} 提取账号 sec_user_id 失败").format(url=url)
                )
                continue
            await self.__account_detail_handle(
                links,
                True,
                *args,
            )

    async def account_detail_txt(
        self,
    ):
        await self._read_from_txt(
            tiktok=False,
            type_="user",
            error=_("从文本文档提取账号 sec_user_id 失败"),
            callback=self.__account_detail_handle,
        )

    async def _read_from_txt(
        self,
        tiktok=False,
        type_: str = ...,
        error: str = ...,
        callback: Callable = ...,
        *args,
        **kwargs,
    ):
        if not (url := self.txt_inquire()):
            return
        link_obj = self.links_tiktok if tiktok else self.links
        links = await link_obj.run(
            url,
            type_,
        )
        if not links or not isinstance(links[0], bool | None):
            links = [links]
        if not links[-1]:
            self.logger.warning(error)
            return
        await callback(
            *links,
            *args,
            tiktok=tiktok,
            **kwargs,
        )

    async def account_detail_txt_tiktok(
        self,
    ):
        await self._read_from_txt(
            tiktok=True,
            type_="user",
            error=_("从文本文档提取账号 sec_user_id 失败"),
            callback=self.__account_detail_handle,
        )

    async def __account_detail_handle(
        self,
        links: list[str],
        tiktok=False,
        *args,
        **kwargs,
    ):
        count = SimpleNamespace(time=time(), success=0, failed=0)
        for index, sec in enumerate(links, start=1):
            if not await self.deal_account_detail(
                index,
                sec_user_id=sec,
                tiktok=tiktok,
                *args,
                **kwargs,
            ):
                count.failed += 1
                continue
            count.success += 1
            if index != len(links):
                await suspend(index, self.console)
        self.__summarize_results(
            count,
            _("账号"),
        )

    async def deal_account_detail(
        self,
        index: int,
        sec_user_id: str,
        mark="",
        tab="post",
        earliest="",
        latest="",
        pages: int = None,
        api=False,
        source=False,
        cookie: str = None,
        proxy: str = None,
        tiktok=False,
        *args,
        **kwargs,
    ):
        self.logger.info(
            _("开始处理第 {index} 个账号").format(index=index)
            if index
            else _("开始处理账号")
        )
        if api:
            info = None
        elif not (
            info := await self.get_user_info_data(
                tiktok,
                cookie,
                proxy,
                sec_user_id=sec_user_id,
            )
        ):
            self.logger.info(
                _("{sec_user_id} 获取账号信息失败，请检查 Cookie 登录状态！").format(
                    sec_user_id=sec_user_id
                )
            )
            if tab in {
                "favorite",
                "collection",
            }:
                return
            self.logger.info(
                _(
                    "如果账号发布作品均为共创作品且该账号均不是作品作者时，请配置已登录的 Cookie 后重新运行程序，其余情况请无视该提示！"
                )
            )
        acquirer = self._get_account_data_tiktok if tiktok else self._get_account_data
        account_data, earliest, latest = await acquirer(
            cookie=cookie,
            proxy=proxy,
            sec_user_id=sec_user_id,
            tab=tab,
            earliest=earliest,
            latest=latest,
            pages=pages,
            **kwargs,
        )
        if not any(account_data):
            return None
        if source:
            return self.extractor.source_date_filter(
                account_data,
                earliest,
                latest,
                tiktok,
            )
        return await self._batch_process_detail(
            account_data,
            user_id=sec_user_id,
            mark=mark,
            api=api,
            earliest=earliest,
            latest=latest,
            tiktok=tiktok,
            mode=tab,
            info=info,
        )

    async def _get_account_data(
        self,
        cookie: str = None,
        proxy: str = None,
        sec_user_id: Union[str] = ...,
        tab: str = "post",
        earliest: str = "",
        latest: str = "",
        pages: int = None,
        *args,
        **kwargs,
    ):
        return await Account(
            self.parameter,
            cookie,
            proxy,
            sec_user_id,
            tab,
            earliest,
            latest,
            pages,
        ).run()

    async def _get_account_data_tiktok(
        self,
        cookie: str = None,
        proxy: str = None,
        sec_user_id: Union[str] = ...,
        tab: str = "post",
        earliest: str = "",
        latest: str = "",
        pages: int = None,
        *args,
        **kwargs,
    ):
        return await AccountTikTok(
            self.parameter,
            cookie,
            proxy,
            sec_user_id,
            tab,
            earliest,
            latest,
            pages,
        ).run()

    async def get_user_info_data(
        self,
        tiktok=False,
        cookie: str = None,
        proxy: str = None,
        unique_id: Union[str] = "",
        sec_user_id: Union[str] = "",
    ):
        return (
            await self._get_info_data_tiktok(
                cookie,
                proxy,
                unique_id,
                sec_user_id,
            )
            if tiktok
            else await self._get_info_data(
                cookie,
                proxy,
                sec_user_id,
            )
        )

    async def _get_info_data(
        self,
        cookie: str = None,
        proxy: str = None,
        sec_user_id: Union[str, list[str]] = ...,
    ):
        return await Info(
            self.parameter,
            cookie,
            proxy,
            sec_user_id,
        ).run()

    async def _get_info_data_tiktok(
        self,
        cookie: str = None,
        proxy: str = None,
        unique_id: Union[str] = "",
        sec_user_id: Union[str] = "",
    ):
        return await InfoTikTok(
            self.parameter,
            cookie,
            proxy,
            unique_id,
            sec_user_id,
        ).run()

    async def _batch_process_detail(
        self,
        data: list[dict],
        api: bool = False,
        earliest: date = None,
        latest: date = None,
        tiktok: bool = False,
        info: dict = None,
        mode: str = "",
        mark: str = "",
        user_id: str = "",
        mix_id: str = "",
        mix_title: str = "",
        collect_id: str = "",
        collect_name: str = "",
    ):
        self.logger.info(_("开始提取作品数据"))
        id_, name, mark = self.extractor.preprocessing_data(
            info or data,
            tiktok,
            mode,
            mark,
            user_id,
            mix_id,
            mix_title,
            collect_id,
            collect_name,
        )
        if not api and not all((id_, name, mark)):
            self.logger.error(_("提取账号或合集信息发生错误！"))
            return False
        self.__display_extracted_information(
            id_,
            name,
            mark,
        )
        prefix = self._generate_prefix(mode)
        suffix = self._generate_suffix(mode)
        old_mark = (
            f"{m['MARK']}_{suffix}" if (m := await self.cache.has_cache(id_)) else None
        )
        root, params, logger = self.record.run(
            self.parameter,
            blank=api,
        )
        async with logger(
            root,
            name=f"{prefix}{id_}_{mark}_{suffix}",
            old=old_mark,
            console=self.console,
            **params,
        ) as recorder:
            data = await self.extractor.run(
                data,
                recorder,
                type_="batch",
                tiktok=tiktok,
                name=name,
                mark=mark,
                earliest=earliest or date(2016, 9, 20),
                latest=latest or date.today(),
                same=mode
                in {
                    "post",
                    "mix",
                },
            )
        if api:
            return data
        await self.cache.update_cache(
            self.parameter.folder_mode,
            prefix,
            suffix,
            id_,
            name,
            mark,
        )
        await self.download_detail_batch(
            data,
            tiktok=tiktok,
            mode=mode,
            mark=mark,
            user_id=id_,
            user_name=name,
            mix_id=mix_id,
            mix_title=mix_title,
            collect_id=collect_id,
            collect_name=collect_name,
        )
        return True

    @staticmethod
    def _generate_prefix(
        mode: str,
    ):
        match mode:
            case "post" | "favorite" | "collection":
                return "UID"
            case "mix":
                return "MID"
            case "collects":
                return "CID"
            case _:
                raise DownloaderError

    @staticmethod
    def _generate_suffix(
        mode: str,
    ):
        match mode:
            case "post":
                return _("发布作品")
            case "favorite":
                return _("喜欢作品")
            case "collection":
                return _("收藏作品")
            case "mix":
                return _("合集作品")
            case "collects":
                return _("收藏夹作品")
            case _:
                raise DownloaderError

    def __display_extracted_information(
        self,
        id_: str,
        name: str,
        mark: str,
    ) -> None:
        self.logger.info(
            _("昵称/标题：{name}；标识：{mark}；ID：{id}").format(
                name=name,
                mark=mark,
                id=id_,
            ),
        )

    async def download_detail_batch(
        self,
        data: list[dict],
        type_: str = "batch",
        tiktok: bool = False,
        mode: str = "",
        mark: str = "",
        user_id: str = "",
        user_name: str = "",
        mix_id: str = "",
        mix_title: str = "",
        collect_id: str = "",
        collect_name: str = "",
    ):
        await self.downloader.run(
            data,
            type_,
            tiktok,
            mode=mode,
            mark=mark,
            user_id=user_id,
            user_name=user_name,
            mix_id=mix_id,
            mix_title=mix_title,
            collect_id=collect_id,
            collect_name=collect_name,
        )

    async def detail_interactive(
        self,
        select="",
    ):
        await self.__secondary_menu(
            _("请选择作品链接来源"),
            self.__function_detail,
            select or safe_pop(self.run_command),
        )
        self.logger.info(_("已退出批量下载链接作品(抖音)模式"))

    async def detail_interactive_tiktok(
        self,
        select="",
    ):
        await self.__detail_secondary_menu(
            self.__function_detail_tiktok,
            select or safe_pop(self.run_command),
        )
        self.logger.info(_("已退出批量下载链接作品(TikTok)模式"))

    async def detail_interactive_tiktok_unofficial(
        self,
        select="",
    ):
        self.console.warning(
            _("注意：本功能为实验性功能，依赖第三方 API 服务，可能不稳定或存在限制！")
        )
        await self.__detail_secondary_menu(
            self.__function_detail_tiktok_unofficial,
            select or safe_pop(self.run_command),
        )
        self.logger.info(_("已退出批量下载视频原画(TikTok)模式"))

    async def __detail_secondary_menu(self, menu, select="", *args, **kwargs):
        root, params, logger = self.record.run(self.parameter)
        async with logger(root, console=self.console, **params) as record:
            if not select:
                select = choose(
                    _("请选择作品链接来源"),
                    [i[0] for i in menu],
                    self.console,
                )
            if select.upper() == "Q":
                self.running = False
            try:
                n = int(select) - 1
            except ValueError:
                return
            if n in range(len(menu)):
                await menu[n][1](record)

    async def __detail_inquire(
        self,
        tiktok=False,
    ):
        root, params, logger = self.record.run(self.parameter)
        link_obj = self.links_tiktok if tiktok else self.links
        async with logger(root, console=self.console, **params) as record:
            while url := self._inquire_input(_("作品")):
                ids = await link_obj.run(url)
                if not any(ids):
                    self.logger.warning(_("{url} 提取作品 ID 失败").format(url=url))
                    continue
                self.console.print(
                    _("共提取到 {count} 个作品，开始处理！").format(count=len(ids))
                )
                await self._handle_detail(
                    ids,
                    tiktok,
                    record,
                )

    async def __detail_inquire_tiktok(
        self,
        tiktok=True,
    ):
        await self.__detail_inquire(
            tiktok,
        )

    async def __detail_inquire_tiktok_unofficial(
        self,
        *args,
        **kwargs,
    ):
        while url := self._inquire_input(_("作品")):
            ids = await self.links_tiktok.run(url)
            if not any(ids):
                self.logger.warning(_("{url} 提取作品 ID 失败").format(url=url))
                continue
            self.console.print(
                _("共提取到 {count} 个作品，开始处理！").format(count=len(ids))
            )
            await self.handle_detail_unofficial(ids)

    async def __detail_txt(
        self,
        tiktok=False,
    ):
        root, params, logger = self.record.run(self.parameter)
        async with logger(root, console=self.console, **params) as record:
            await self._read_from_txt(
                tiktok,
                "detail",
                _("从文本文档提取作品 ID 失败"),
                self._handle_detail,
                record=record,
            )

    async def __detail_txt_tiktok(
        self,
        tiktok=True,
    ):
        await self.__detail_txt(
            tiktok=tiktok,
        )

    async def __detail_txt_tiktok_unofficial(
        self,
        *args,
        **kwargs,
    ):
        await self._read_from_txt(
            True,
            "detail",
            _("从文本文档提取作品 ID 失败"),
            self.handle_detail_unofficial,
        )

    async def __read_detail_txt(self):
        if not (url := self.txt_inquire()):
            return
        ids = await self.links.run(url)
        if not any(ids):
            self.logger.warning(_("从文本文档提取作品 ID 失败"))
            return
        self.console.print(
            _("共提取到 {count} 个作品，开始处理！").format(count=len(ids))
        )
        return ids

    async def _handle_detail(
        self,
        ids: list[str],
        tiktok: bool,
        record,
        api=False,
        source=False,
        cookie: str = None,
        proxy: str = None,
    ):
        processor = DetailTikTok if tiktok else Detail
        return await self.__handle_detail(
            tiktok,
            processor,
            ids,
            record,
            api=api,
            source=source,
            cookie=cookie,
            proxy=proxy,
        )

    async def handle_detail_single(
        self,
        processor: Callable,
        cookie: str,
        proxy: str,
        detail_id: str,
    ):
        try:
            self.logger.info(f"🔍 开始获取作品详情: {detail_id}")
            self.logger.info(f"📋 Cookie状态: {'有效' if cookie else '无'} (长度: {len(cookie) if cookie else 0})")
            
            result = await processor(
                self.parameter,
                cookie,
                proxy,
                detail_id,
            ).run()
            
            if result:
                self.logger.info(f"✅ 作品详情获取成功: {detail_id}")
            else:
                self.logger.warning(f"❌ 作品详情获取失败: {detail_id} - 返回数据为空")
                
            return result
        except Exception as e:
            self.logger.error(f"💥 作品详情获取异常: {detail_id} - {str(e)}")
            return None

    async def __handle_detail(
        self,
        tiktok: bool,
        processor: Callable,
        ids: list[str],
        record,
        api=False,
        source=False,
        cookie: str = None,
        proxy: str = None,
    ):
        self.logger.info(f"🚀 开始批量处理作品: {len(ids)}个")
        self.logger.info(f"📝 作品ID列表: {ids}")
        
        detail_data = [
            await self.handle_detail_single(
                processor,
                cookie,
                proxy,
                i,
            )
            for i in ids
        ]
        
        valid_data = [d for d in detail_data if d]
        self.logger.info(f"📊 处理结果: {len(valid_data)}/{len(detail_data)} 个作品获取成功")
        
        if not any(detail_data):
            self.logger.warning("❌ 所有作品详情获取失败，返回None")
            return None
        if source:
            return detail_data
        detail_data = await self.extractor.run(
            detail_data,
            record,
            tiktok=tiktok,
        )
        if api:
            return detail_data
        await self.downloader.run(detail_data, "detail", tiktok=tiktok)
        return self._get_preview_image(detail_data[0])

    @staticmethod
    def _get_preview_image(data: dict) -> str:
        if data["type"] == _("图集"):
            return data["downloads"][0]
        elif data["type"] == _("视频"):
            return data["static_cover"]
        return ""

    def _choice_live_quality(
        self,
        flv_items: dict,
        m3u8_items: dict,
    ) -> tuple | None:
        if not self.ffmpeg:
            self.logger.warning(_("程序未检测到有效的 ffmpeg，不支持直播下载功能！"))
            return None
        try:
            choice_ = self.parameter.live_qualities or self.console.input(
                _("请选择下载清晰度(输入清晰度或者对应序号，直接回车代表不下载): "),
            )
            if u := flv_items.get(choice_):
                return u, m3u8_items.get(choice_)
            if not 0 <= (i := int(choice_) - 1) < len(flv_items):
                raise ValueError
        except ValueError:
            self.logger.info(_("未输入有效的清晰度或者序号，跳过下载！"))
            return None
        return list(flv_items.values())[i], list(m3u8_items.values())[i]

    async def get_live_data(
        self,
        web_rid: str = None,
        room_id: str = None,
        sec_user_id: str = None,
        cookie: str = None,
        proxy: str = None,
    ):
        return await Live(
            self.parameter,
            cookie,
            proxy,
            web_rid,
            room_id,
            sec_user_id,
        ).run()

    async def get_live_data_tiktok(
        self,
        room_id: str = None,
        cookie: str = None,
        proxy: str = None,
    ):
        return await LiveTikTok(self.parameter, cookie, proxy, room_id).run()

    async def live_interactive(
        self,
        *args,
    ):
        while url := self._inquire_input(_("直播")):
            ids = await self.links.run(url, type_="live")
            live_data = [await self.get_live_data(i) for i in ids]
            live_data = await self.extractor.run(live_data, None, "live")
            if not [i for i in live_data if i]:
                self.logger.warning(_("获取直播数据失败"))
                continue
            download_tasks = self.show_live_info(live_data)
            await self.downloader.run(download_tasks, type_="live")
        self.logger.info(_("已退出获取直播推流地址(抖音)模式"))

    async def live_interactive_tiktok(
        self,
        *args,
    ):
        while url := self._inquire_input(_("直播")):
            ids = await self.links_tiktok.run(url, type_="live")
            if not ids:
                self.logger.warning(_("{} 提取直播 ID 失败").format(url=url))
                continue
            live_data = [await self.get_live_data_tiktok(i) for i in ids]
            if not [i for i in live_data if i]:
                self.logger.warning(_("获取直播数据失败"))
                continue
            live_data = await self.extractor.run(
                live_data,
                None,
                "live",
                tiktok=True,
            )
            download_tasks = self.show_live_info_tiktok(live_data)
            await self.downloader.run(download_tasks, type_="live", tiktok=True)
        self.logger.info(_("已退出获取直播推流地址(TikTok)模式"))

    # def _generate_live_params(self, rid: bool, ids: list[list]) -> list[dict]:
    #     if not ids:
    #         self.console.warning(
    #             _("提取 web_rid 或者 room_id 失败！"),
    #         )
    #         return []
    #     if rid:
    #         return [{"web_rid": id_} for id_ in ids]
    #     else:
    #         return [{"room_id": id_[0], "sec_user_id": id_[1]} for id_ in ids]

    def show_live_info(self, data: list[dict]) -> list[tuple]:
        download_tasks = []
        for item in data:
            self.console.print(_("直播标题:"), item["title"])
            self.console.print(_("主播昵称:"), item["nickname"])
            self.console.print(_("在线观众:"), item["user_count_str"])
            self.console.print(_("观看次数:"), item["total_user_str"])
            if item["status"] == 4:
                self.console.print(_("当前直播已结束！"))
                continue
            self.show_live_stream_url(item, download_tasks)
        return [i for i in download_tasks if isinstance(i, tuple)]

    def show_live_info_tiktok(self, data: list[dict]) -> list[tuple]:
        download_tasks = []
        for item in data:
            if item["message"]:
                self.console.print(item["message"])
                self.console.print(item["prompts"])
                continue
            self.console.print(_("直播标题:"), item["title"])
            self.console.print(_("主播昵称:"), item["nickname"])
            self.console.print(_("开播时间:"), item["create_time"])
            self.console.print(_("在线观众:"), item["user_count"])
            self.console.print(_("点赞次数:"), item["like_count"])
            self.show_live_stream_url_tiktok(item, download_tasks)
        return [i for i in download_tasks if isinstance(i, tuple)]

    def show_live_stream_url(self, item: dict, tasks: list):
        self.console.print(_("FLV 推流地址: "))
        for i, (k, v) in enumerate(item["flv_pull_url"].items(), start=1):
            self.console.print(i, k, v)
        self.console.print(_("M3U8 推流地址: "))
        for i, (k, v) in enumerate(item["hls_pull_url_map"].items(), start=1):
            self.console.print(i, k, v)
        if self.parameter.download:
            tasks.append(
                (item, *u)
                if (
                    u := self._choice_live_quality(
                        item["flv_pull_url"],
                        item["hls_pull_url_map"],
                    )
                )
                else u
            )

    def show_live_stream_url_tiktok(self, item: dict, tasks: list):
        self.console.print(_("FLV 推流地址: "))
        for i, (k, v) in enumerate(item["flv_pull_url"].items(), start=1):
            self.console.print(i, k, v)
        if self.parameter.download:
            tasks.append(
                (
                    item,
                    *u,
                )
                # TikTok 平台 暂无 m3u8 地址
                if (
                    u := self._choice_live_quality(
                        item["flv_pull_url"],
                        item["flv_pull_url"],
                    )
                )
                else u
            )

    @check_storage_format
    async def comment_interactive_tiktok(self, select="", *args, **kwargs):
        ...
        self.logger.info(_("已退出采集作品评论数据(TikTok)模式"))

    @check_storage_format
    async def comment_interactive(
        self,
        select="",
    ):
        await self.__secondary_menu(
            _("请选择作品链接来源"),
            self.__function_comment,
            select or safe_pop(self.run_command),
        )
        self.logger.info(_("已退出采集作品评论数据(抖音)模式)"))

    async def __comment_inquire(
        self,
        tiktok=False,
    ):
        link = self.links_tiktok if tiktok else self.links
        while url := self._inquire_input(_("作品")):
            ids = await link.run(
                url,
            )
            if not any(ids):
                self.logger.warning(_("{url} 提取作品 ID 失败").format(url=url))
                continue
            self.console.print(
                _("共提取到 {count} 个作品，开始处理！").format(count=len(ids))
            )
            await self.comment_handle(
                ids,
                tiktok=tiktok,
            )

    async def __comment_inquire_tiktok(
        self,
    ):
        await self.__comment_inquire(
            True,
        )

    async def __comment_txt(
        self,
        tiktok=False,
    ):
        await self._read_from_txt(
            tiktok,
            "detail",
            _("从文本文档提取作品 ID 失败"),
            self.comment_handle,
        )

    async def comment_handle_single(
        self,
        detail_id: str,
        cookie: str = None,
        proxy: str = None,
        source: bool = False,
        **kwargs,
    ) -> list:
        if data := await Comment(
            self.parameter,
            cookie,
            proxy,
            detail_id=detail_id,
            **kwargs,
        ).run():
            return data if source else await self.save_comment(detail_id, data)
        return []

    async def comment_handle_single_tiktok(
        self,
        detail_id: str,
        cookie: str = None,
        proxy: str = None,
        source: bool = False,
        **kwargs,
    ) -> list: ...

    async def comment_handle(
        self,
        ids: list,
        tiktok=False,
        cookie: str = None,
        proxy: str = None,
        **kwargs,
    ):
        if tiktok:
            processor = self.comment_handle_single_tiktok
        else:
            processor = self.comment_handle_single
        for i in ids:
            if await processor(
                i,
                cookie,
                proxy,
                **kwargs,
            ):
                self.logger.info(
                    _("作品评论数据已储存至 {filename}").format(
                        filename=_("作品{id}_评论数据").format(id=i),
                    )
                )
            else:
                self.logger.warning(_("采集评论数据失败"))

    async def save_comment(self, detail_id: str, data: list[dict]) -> list:
        root, params, logger = self.record.run(self.parameter, type_="comment")
        async with logger(
            root,
            name=_("作品{id}_评论数据").format(
                id=detail_id,
            ),
            console=self.console,
            **params,
        ) as record:
            return await self.extractor.run(data, record, type_="comment")

    async def reply_handle(
        self,
        detail_id: str,
        comment_id: str,
        pages: int = None,
        cursor=0,
        count=3,
        cookie: str = None,
        proxy: str = None,
        source=False,
    ):
        if data := await Reply(
            self.parameter,
            cookie,
            proxy,
            detail_id=detail_id,
            comment_id=comment_id,
            pages=pages,
            cursor=cursor,
            count=count,
        ).run():
            return data if source else await self.save_comment(detail_id, data)
        return []

    async def reply_handle_tiktok(
        self,
        detail_id: str,
        comment_id: str,
        pages: int = None,
        cursor=0,
        count=3,
        cookie: str = None,
        proxy: str = None,
        source=False,
    ): ...

    async def mix_interactive(
        self,
        select="",
    ):
        await self.__secondary_menu(
            _("请选择合集链接来源"),
            self.__function_mix,
            select or safe_pop(self.run_command),
        )
        self.logger.info(_("已退出批量下载合集作品(抖音)模式"))

    async def mix_interactive_tiktok(
        self,
        select="",
    ):
        await self.__secondary_menu(
            _("请选择合集链接来源"),
            self.__function_mix_tiktok,
            select or safe_pop(self.run_command),
        )
        self.logger.info(_("已退出批量下载合集作品(TikTok)模式"))

    @staticmethod
    def _generate_mix_params(mix: bool, id_: str) -> dict:
        return (
            {
                "mix_id": id_,
            }
            if mix
            else {
                "detail_id": id_,
            }
        )

    async def mix_inquire(
        self,
    ):
        while url := self._inquire_input(_("合集或作品")):
            mix_id, ids = await self.links.run(url, type_="mix")
            if not ids:
                self.logger.warning(
                    _("{url} 获取作品 ID 或合集 ID 失败").format(url=url)
                )
                continue
            await self.__mix_handle(
                mix_id,
                ids,
            )

    async def mix_inquire_tiktok(
        self,
    ):
        while url := self._inquire_input(_("合集或作品")):
            __, ids, title = await self.links_tiktok.run(url, type_="mix")
            if not ids:
                self.logger.warning(_("{url} 获取合集 ID 失败").format(url=url))
                continue
            await self.__mix_handle(
                True,
                ids,
                title,
                True,
            )

    @check_cookie_state(tiktok=False)
    async def mix_collection(
        self,
    ):
        if id_ := await self.mix_inquire_collection():
            await self.__mix_handle(
                True,
                id_,
            )

    async def mix_inquire_collection(self) -> list[str]:
        data = await CollectsMix(self.parameter).run()
        if not any(data):
            return []
        data = self.extractor.extract_mix_collect_info(data)
        return self.input_download_index(data)

    def input_download_index(self, data: list[dict]) -> list[str] | None:
        if d := self.__input_download_index(
            data,
            _("收藏合集"),
        ):
            return [i["id"] for i in d]

    def __input_download_index(
        self,
        data: list[dict],
        text=_("收藏合集"),
        select="",
        key="title",
    ) -> list[dict] | None:
        self.console.print(_("{text}列表：").format(text=_(text)))
        for i, j in enumerate(data, start=1):
            self.console.print(f"{i}. {j[key]}")
        index = select or self.console.input(
            _(
                "请输入需要下载的{item}序号(多个序号使用空格分隔，输入 ALL 下载全部{item})："
            ).format(item=text)
        )
        try:
            if not index:
                pass
            elif index.upper() == "ALL":
                return data
            elif index.upper() == "Q":
                self.running = False
            else:
                index = {int(i) for i in index.split()}
                return [j for i, j in enumerate(data, start=1) if i in index]
        except ValueError:
            self.console.warning(_("{text}序号输入错误！").format(text=text))

    async def mix_txt(
        self,
    ):
        await self._read_from_txt(
            tiktok=False,
            type_="mix",
            error=_("从文本文档提取作品 ID 或合集 ID 失败"),
            callback=self.__mix_handle,
        )

    async def mix_txt_tiktok(
        self,
    ):
        await self._read_from_txt(
            tiktok=True,
            type_="mix",
            error=_("从文本文档提取合集 ID 失败"),
            callback=self.__mix_handle,
        )

        if not (url := self.txt_inquire()):
            return
        __, ids, title = await self.links_tiktok.run(url, type_="mix")
        if not ids:
            self.logger.warning()
            return
        await self.__mix_handle(
            True,
            ids,
            title,
            True,
        )

    async def __mix_handle(
        self,
        mix_id: bool,
        ids: list[str],
        mix_title_map: list[str] = None,
        tiktok=False,
    ):
        count = SimpleNamespace(time=time(), success=0, failed=0)
        for index, i in enumerate(ids, start=1):
            if not await self.deal_mix_detail(
                mix_id,
                i,
                index=index,
                tiktok=tiktok,
                mix_title=mix_title_map[index - 1] if mix_title_map else None,
            ):
                count.failed += 1
                continue
            count.success += 1
            if index != len(ids):
                await suspend(index, self.console)
        self.__summarize_results(
            count,
            _("合集"),
        )

    async def mix_batch(
        self,
    ):
        await self.__mix_batch(
            self.mix,
            "mix_urls",
            False,
        )

    async def mix_batch_tiktok(
        self,
    ):
        await self.__mix_batch(
            self.mix_tiktok,
            "mix_urls_tiktok",
            True,
        )

    async def __mix_batch(
        self,
        mix: list[SimpleNamespace],
        params_name: str,
        tiktok: bool,
    ):
        count = SimpleNamespace(time=time(), success=0, failed=0)
        for index, data in enumerate(mix, start=1):
            mix_id, id_, title = await self._check_mix_id(
                data.url,
                tiktok,
            )
            if not id_:
                self.logger.warning(
                    _(
                        "配置文件 {name} 参数的 url {url} 获取作品 ID 或合集 ID 失败，错误配置：{data}"
                    ).format(
                        name=params_name,
                        url=data.url,
                        data=vars(data),
                    )
                )
                count.failed += 1
                continue
            if not await self.deal_mix_detail(
                mix_id,
                id_,
                data.mark,
                index,
                tiktok=tiktok,
                mix_title=title,
            ):
                count.failed += 1
                continue
            count.success += 1
            if index != len(mix):
                await suspend(index, self.console)
        self.__summarize_results(
            count,
            _("合集"),
        )

    async def deal_mix_detail(
        self,
        mix_id: bool = None,
        id_: str = None,
        mark="",
        index: int = 0,
        api=False,
        source=False,
        cookie: str = None,
        proxy: str = None,
        tiktok=False,
        mix_title: str = "",
        **kwargs,
    ):
        self.logger.info(
            _("开始处理第 {index} 个合集").format(index=index)
            if index
            else _("开始处理合集")
        )
        mix_params = self._generate_mix_params(mix_id, id_)
        if tiktok:
            mix_obj = MixTikTok(
                self.parameter,
                cookie,
                proxy,
                mix_title=mix_title,
                **mix_params,
                **kwargs,
            )
        else:
            mix_obj = Mix(
                self.parameter,
                cookie,
                proxy,
                **mix_params,
                **kwargs,
            )
        if any(mix_data := await mix_obj.run()):
            return (
                mix_data
                if source
                else await self._batch_process_detail(
                    mix_data,
                    mode="mix",
                    mix_id=mix_obj.mix_id,
                    mark=mark,
                    api=api,
                    tiktok=tiktok,
                )
            )
        self.logger.warning(_("采集合集作品数据失败"))

    async def _check_mix_id(
        self,
        url: str,
        tiktok: bool,
    ) -> tuple[bool, str, str]:
        match tiktok:
            case True:
                _, ids, title = await self.links_tiktok.run(url, type_="mix")
                return (True, ids[0], title[0]) if len(ids) > 0 else (None, "", "")
            case False:
                mix_id, ids = await self.links.run(url, type_="mix")
                return (mix_id, ids[0], "") if len(ids) > 0 else (mix_id, "", "")
            case _:
                raise DownloaderError

    async def user_batch(
        self,
        *args,
        **kwargs,
    ):
        users = []
        for index, data in enumerate(self.accounts, start=1):
            if not (sec_user_id := await self.check_sec_user_id(data.url)):
                self.logger.warning(
                    _("配置文件 accounts_urls 参数第 {index} 条数据的 url 无效").format(
                        index=index
                    ),
                )
                continue
            users.append(await self._get_user_data(sec_user_id))
        await self._deal_user_data([i for i in users if i])

    async def user_inquire(
        self,
        *args,
        **kwargs,
    ):
        while url := self._inquire_input(_("账号主页")):
            sec_user_ids = await self.links.run(url, type_="user")
            if not sec_user_ids:
                self.logger.warning(
                    _("{url} 提取账号 sec_user_id 失败").format(url=url)
                )
                continue
            users = [await self._get_user_data(i) for i in sec_user_ids]
            await self._deal_user_data([i for i in users if i])

    def txt_inquire(self) -> str:
        if path := self.console.input(_("请输入文本文档路径：")):
            if (t := Path(path.replace('"', ""))).is_file():
                try:
                    with t.open("r", encoding=self.ENCODE) as f:
                        return f.read()
                except UnicodeEncodeError as e:
                    self.logger.warning(
                        _("{path} 文件读取异常: {error}").format(path=path, error=e)
                    )
            else:
                self.console.print(_("{path} 文件不存在！").format(path=path))
        return ""

    async def user_txt(
        self,
        *args,
        **kwargs,
    ):
        if not (url := self.txt_inquire()):
            return
        sec_user_ids = await self.links.run(url, type_="user")
        if not sec_user_ids:
            self.logger.warning(_("从文本文档提取账号 sec_user_id 失败"))
            return
        users = [await self._get_user_data(i) for i in sec_user_ids]
        await self._deal_user_data([i for i in users if i])

    async def _get_user_data(
        self,
        sec_user_id: str,
        cookie: str = None,
        proxy: str = None,
    ):
        self.logger.info(
            _("正在获取账号 {sec_user_id} 的数据").format(sec_user_id=sec_user_id)
        )
        data = await User(
            self.parameter,
            cookie,
            proxy,
            sec_user_id,
        ).run()
        return data or {}

    async def _deal_user_data(
        self,
        data: list[dict],
        source=False,
    ):
        if not any(data):
            return None
        if source:
            return data
        root, params, logger = self.record.run(
            self.parameter,
            type_="user",
        )
        async with logger(
            root, name="UserData", console=self.console, **params
        ) as recorder:
            data = await self.extractor.run(data, recorder, type_="user")
        self.logger.info(_("账号数据已保存至文件"))
        return data

    @check_storage_format
    async def user_interactive(self, select="", *args, **kwargs):
        await self.__secondary_menu(
            _("请选择账号链接来源"),
            function=self.__function_user,
            select=select or safe_pop(self.run_command),
        )
        self.logger.info(_("已退出采集账号详细数据模式"))

    def _enter_search_criteria(
        self,
        field: str,
    ) -> list[Any]:
        criteria = self.console.input(
            _("请输入搜索参数；参数之间使用两个空格分隔({field})：\n").format(
                field=field
            ),
        )
        if criteria.upper() == "Q":
            self.running = False
            return []
        return criteria.split("  ") if criteria else []

    @staticmethod
    def fill_search_criteria(criteria: list[Any]) -> list[Any]:
        if len(criteria) == 1:
            criteria.append(1)
        while len(criteria) < 9:
            criteria.append(0)
        return criteria

    @check_storage_format
    async def search_interactive(
        self,
        select="",
    ):
        await self.__secondary_menu(
            _("请选择搜索模式"),
            function=self.__function_search,
            select=select or safe_pop(self.run_command),
        )
        self.logger.info("已退出采集搜索结果数据模式")

    @staticmethod
    def generate_model(
        channel: int,
        keyword: str,
        pages: int = 1,
        sort_type: int = 0,
        publish_time: int = 0,
        duration: int = 0,
        search_range: int = 0,
        content_type: int = 0,
        douyin_user_fans: int = 0,
        douyin_user_type: int = 0,
    ) -> Union["BaseModel", str]:
        try:
            match channel:
                case 0:
                    return GeneralSearch(
                        keyword=keyword,
                        pages=pages,
                        sort_type=sort_type,
                        publish_time=publish_time,
                        duration=duration,
                        search_range=search_range,
                        content_type=content_type,
                    )
                case 1:
                    return VideoSearch(
                        keyword=keyword,
                        pages=pages,
                        sort_type=sort_type,
                        publish_time=publish_time,
                        duration=duration,
                        search_range=search_range,
                    )
                case 2:
                    return UserSearch(
                        keyword=keyword,
                        pages=pages,
                        douyin_user_fans=douyin_user_fans,
                        douyin_user_type=douyin_user_type,
                    )
                case 3:
                    return LiveSearch(
                        keyword=keyword,
                        pages=pages,
                    )
                case _:
                    raise DownloaderError
        except ValidationError as e:
            return repr(e)

    async def _search_interactive_general(
        self,
        index=0,
    ):
        while criteria := self._enter_search_criteria(Search.search_criteria[index]):
            criteria = self.fill_search_criteria(criteria)
            if isinstance(
                model := self.generate_model(
                    index,
                    *criteria,
                ),
                str,
            ):
                self.logger.warning(model)
                continue
            self.logger.info(f"搜索参数: {model.model_dump()}", False)
            if isinstance(
                r := await self.deal_search_data(
                    model,
                ),
                list,
            ) and not any(r):
                self.logger.warning(_("搜索结果为空"))

    async def _search_interactive_video(self):
        await self._search_interactive_general(
            1,
        )

    async def _search_interactive_user(self):
        await self._search_interactive_general(
            2,
        )

    async def _search_interactive_live(self):
        await self._search_interactive_general(
            3,
        )

    @staticmethod
    def _generate_search_name(
        model: "BaseModel",
    ) -> str:
        name = [
            _("搜索数据"),
            f"{datetime.now():%Y_%m_%d_%H_%M_%S}",
            Search.search_params[model.channel].note,
        ]
        match model.channel:
            case 0:
                name.extend(
                    [
                        model.keyword,
                        Search.sort_type_help[model.sort_type],
                        Search.publish_time_help[model.publish_time],
                        Search.duration_help[model.duration],
                        Search.search_range_help[model.search_range],
                        Search.content_type_help[model.content_type],
                    ]
                )
            case 1:
                name.extend(
                    [
                        model.keyword,
                        Search.sort_type_help[model.sort_type],
                        Search.publish_time_help[model.publish_time],
                        Search.duration_help[model.duration],
                        Search.search_range_help[model.search_range],
                    ]
                )
            case 2:
                name.extend(
                    [
                        model.keyword,
                        Search.douyin_user_fans_help[model.douyin_user_fans],
                        Search.douyin_user_type_help[model.douyin_user_type],
                    ]
                )
            case 3:
                name.append(
                    model.keyword,
                )
        return "_".join(name)

    async def deal_search_data(
        self,
        model: "BaseModel",
        source=False,
    ):
        data = await Search(
            self.parameter,
            **model.model_dump(),
        ).run()
        if len(data) != 1 and not any(data):
            return None
        if source or not any(data):
            return data
        root, params, logger = self.record.run(
            self.parameter,
            type_=Search.search_data_field[model.channel],
        )
        name = self._generate_search_name(
            model,
        )
        async with logger(root, name=name, console=self.console, **params) as logger:
            search_data = await self.extractor.run(
                data,
                logger,
                type_="search",
                tab=model.channel,
            )
            self.logger.info(_("搜索数据已保存至 {name}").format(name=name))
        return search_data

    @check_storage_format
    async def hot_interactive(
        self,
        *args,
    ):
        await self._deal_hot_data()
        self.logger.info(_("已退出采集抖音热榜数据(抖音)模式"))

    async def _deal_hot_data(
        self,
        source=False,
        cookie: str = None,
        proxy: str = None,
    ):
        time_, board = await Hot(
            self.parameter,
            cookie,
            proxy,
        ).run()
        if not any(board):
            return None, None
        if source:
            return time_, [{Hot.board_params[i].name: j} for i, j in board]
        root, params, logger = self.record.run(self.parameter, type_="hot")
        data = []
        for i, j in board:
            name = _("热榜数据_{time}_{name}").format(
                time=time_, name=Hot.board_params[i].name
            )
            async with logger(
                root, name=name, console=self.console, **params
            ) as record:
                data.append(
                    {
                        Hot.board_params[i].name: await self.extractor.run(
                            j, record, type_="hot"
                        )
                    }
                )
        self.logger.info(
            _("热榜数据已储存至: 热榜数据_{time} + 榜单类型").format(time=time_)
        )
        return time_, data

    @check_cookie_state(tiktok=False)
    async def collection_interactive(
        self,
        *args,
    ):
        if sec_user_id := await self.__check_owner_url():
            start = time()
            await self._deal_collection_data(
                sec_user_id,
            )
            self._time_statistics(start)
        self.logger.info(_("已退出批量下载收藏作品(抖音)模式"))

    @check_cookie_state(tiktok=False)
    async def collects_interactive(
        self,
        select="",
        key: str = "name",
    ):
        if c := await self.__get_collects_list(
            select=select,
            key=key,
        ):
            start = time()
            for i in c:
                await self._deal_collects_data(
                    i[key],
                    i["id"],
                )
            self._time_statistics(start)
        else:
            self.logger.info(_("已退出批量下载收藏夹作品(抖音)模式"))

    async def __get_collects_list(
        self,
        cookie: str = None,
        proxy: str | dict = None,
        # api=False,
        source=False,
        select="",
        key: str = "name",
        *args,
        **kwargs,
    ):
        collects = await Collects(
            self.parameter,
            cookie,
            proxy,
        ).run()
        if not any(collects):
            return None
        if source:
            return collects
        data = self.extractor.extract_collects_info(collects)
        return self.__input_download_index(
            data,
            _("收藏夹"),
            select,
            key,
        )

    async def __check_owner_url(
        self,
        tiktok=False,
    ):
        if not (sec_user_id := await self.check_sec_user_id(self.owner.url)):
            self.logger.warning(
                _("配置文件 owner_url 的 url 参数 {url} 无效").format(
                    url=self.owner.url
                ),
            )
            # if self.console.input(
            #         _("程序无法获取账号信息，建议修改配置文件后重新运行，是否返回上一级菜单(YES/NO)")
            # ).upper != "NO":
            #     return None
            return ""
        return sec_user_id

    @check_cookie_state(tiktok=False)
    async def collection_music_interactive(
        self,
        *args,
    ):
        start = time()
        if data := await self.__handle_collection_music(
            *args,
        ):
            data = await self.extractor.run(
                data,
                None,
                "music",
            )
            await self.downloader.run(
                data,
                type_="music",
            )
        self._time_statistics(start)
        self.logger.info(_("已退出批量下载收藏音乐(抖音)模式"))

    def _time_statistics(
        self,
        start: float,
    ):
        time_ = time() - start
        self.logger.info(
            _("程序运行耗时 {minutes} 分钟 {seconds} 秒").format(
                minutes=int(time_ // 60), seconds=int(time_ % 60)
            )
        )

    async def __handle_collection_music(
        self,
        cookie: str = None,
        proxy: str = None,
        *args,
        **kwargs,
    ):
        data = await CollectsMusic(
            self.parameter,
            cookie,
            proxy,
            *args,
            **kwargs,
        ).run()
        return data if any(data) else None

    async def _deal_collection_data(
        self,
        sec_user_id: str,
        api=False,
        source=False,
        cookie: str = None,
        proxy: str = None,
        tiktok=False,
    ):
        self.logger.info(_("开始获取收藏数据"))
        if not (
            info := await self.get_user_info_data(
                tiktok,
                cookie,
                proxy,
                sec_user_id=sec_user_id,
            )
        ):
            self.logger.warning(
                _("{sec_user_id} 获取账号信息失败").format(sec_user_id=sec_user_id)
            )
            return
        collection = await Collection(
            self.parameter,
            cookie,
            proxy,
            sec_user_id,
        ).run()
        if not any(collection):
            return None
        if source:
            return collection
        await self._batch_process_detail(
            collection,
            api,
            tiktok=tiktok,
            mode="collection",
            mark=self.owner.mark,
            user_id=sec_user_id,
            info=info,
        )

    async def _deal_collects_data(
        self,
        name: str,
        id_: str,
        api=False,
        source=False,
        cookie: str = None,
        proxy: str = None,
        tiktok=False,
    ):
        self.logger.info(_("开始获取收藏夹数据"))
        data = await CollectsDetail(
            self.parameter,
            cookie,
            proxy,
            id_,
        ).run()
        if not any(data):
            return None
        if source:
            return data
        await self._batch_process_detail(
            data,
            mode="collects",
            collect_id=id_,
            collect_name=name,
            api=api,
            tiktok=tiktok,
        )

    async def hashtag_interactive(
        self,
        cookie: str = None,
        proxy: str = None,
        *args,
        **kwargs,
    ):
        await HashTag(
            self.parameter,
            cookie,
            proxy,
        ).run()

    async def handle_detail_unofficial(
        self,
        ids: list[str],
        *args,
        **kwargs,
    ):
        extractor = DetailTikTokExtractor(self.parameter)
        for i in ids:
            if data := await DetailTikTokUnofficial(
                self.parameter,
                detail_id=i,
            ).run():
                if data := extractor.run(data):
                    await self.downloader.run([data], "detail", tiktok=True)

    async def run(self, run_command: list):
        self.run_command = run_command
        while self.running:
            if not (select := safe_pop(self.run_command)):
                select = choose(
                    _("请选择采集功能"),
                    [i for i, __ in self.__function],
                    self.console,
                    (11,),
                )
            if select in {
                "Q",
                "q",
            }:
                self.running = False
            try:
                n = int(select) - 1
            except ValueError:
                break
            if n in range(len(self.__function)):
                await self.__function[n][1](safe_pop(self.run_command))
