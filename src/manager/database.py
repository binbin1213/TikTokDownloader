from asyncio import CancelledError
from contextlib import suppress
from shutil import move

from aiosqlite import Row, connect

from ..custom import PROJECT_ROOT

__all__ = ["Database"]


class Database:
    __FILE = "DouK-Downloader.db"

    def __init__(
        self,
    ):
        self.file = PROJECT_ROOT.joinpath(self.__FILE)
        self.database = None
        self.cursor = None

    async def __connect_database(self):
        # 确保数据库文件的父目录存在
        try:
            self.file.parent.mkdir(parents=True, exist_ok=True)
            
            # 检查目录权限
            if not self.file.parent.exists():
                raise OSError(f"无法创建数据库目录: {self.file.parent}")
            
            # 如果数据库文件不存在，检查是否可以在目录中创建文件
            if not self.file.exists():
                test_file = self.file.parent / ".write_test"
                try:
                    test_file.touch()
                    test_file.unlink()
                except (OSError, PermissionError) as e:
                    raise OSError(f"数据库目录没有写权限: {self.file.parent}, 错误: {e}")
            
        except (OSError, PermissionError) as e:
            raise OSError(f"数据库初始化失败: {e}")
        
        # 尝试创建数据库连接
        self.database = await connect(self.file)
        self.database.row_factory = Row
        self.cursor = await self.database.cursor()
        await self.__create_table()
        await self.__write_default_config()
        await self.__write_default_option()
        await self.database.commit()

    async def __create_table(self):
        await self.database.execute(
            """CREATE TABLE IF NOT EXISTS config_data (
            NAME TEXT PRIMARY KEY,
            VALUE INTEGER NOT NULL CHECK(VALUE IN (0, 1))
            );"""
        )
        await self.database.execute(
            "CREATE TABLE IF NOT EXISTS download_data (ID TEXT PRIMARY KEY);"
        )
        await self.database.execute("""CREATE TABLE IF NOT EXISTS mapping_data (
        ID TEXT PRIMARY KEY,
        NAME TEXT NOT NULL,
        MARK TEXT NOT NULL
        );""")
        await self.database.execute("""CREATE TABLE IF NOT EXISTS option_data (
        NAME TEXT PRIMARY KEY,
        VALUE TEXT NOT NULL
        );""")

    async def __write_default_config(self):
        await self.database.execute("""INSERT OR IGNORE INTO config_data (NAME, VALUE)
                            VALUES ('Record', 1),
                            ('Logger', 0),
                            ('Disclaimer', 0);""")

    async def __write_default_option(self):
        await self.database.execute("""INSERT OR IGNORE INTO option_data (NAME, VALUE)
                            VALUES ('Language', 'zh_CN');""")

    async def read_config_data(self):
        await self.cursor.execute("SELECT * FROM config_data")
        return await self.cursor.fetchall()

    async def read_option_data(self):
        await self.cursor.execute("SELECT * FROM option_data")
        return await self.cursor.fetchall()

    async def update_config_data(
        self,
        name: str,
        value: int,
    ):
        await self.database.execute(
            "REPLACE INTO config_data (NAME, VALUE) VALUES (?,?)", (name, value)
        )
        await self.database.commit()

    async def update_option_data(
        self,
        name: str,
        value: str,
    ):
        await self.database.execute(
            "REPLACE INTO option_data (NAME, VALUE) VALUES (?,?)", (name, value)
        )
        await self.database.commit()

    async def update_mapping_data(self, id_: str, name: str, mark: str):
        await self.database.execute(
            "REPLACE INTO mapping_data (ID, NAME, MARK) VALUES (?,?,?)",
            (id_, name, mark),
        )
        await self.database.commit()

    async def read_mapping_data(self, id_: str):
        await self.cursor.execute(
            "SELECT NAME, MARK FROM mapping_data WHERE ID=?", (id_,)
        )
        return await self.cursor.fetchone()

    async def has_download_data(self, id_: str) -> bool:
        await self.cursor.execute("SELECT ID FROM download_data WHERE ID=?", (id_,))
        return bool(await self.cursor.fetchone())

    async def write_download_data(self, id_: str):
        await self.database.execute(
            "INSERT OR IGNORE INTO download_data (ID) VALUES (?);", (id_,)
        )
        await self.database.commit()

    async def delete_download_data(self, ids: list | tuple | str):
        if not ids:
            return
        if isinstance(ids, str):
            ids = [ids]
        [await self.__delete_download_data(i) for i in ids]
        await self.database.commit()

    async def __delete_download_data(self, id_: str):
        await self.database.execute("DELETE FROM download_data WHERE ID=?", (id_,))

    async def delete_all_download_data(self):
        await self.database.execute("DELETE FROM download_data")
        await self.database.commit()

    async def __aenter__(self):
        self.compatible()
        await self.__connect_database()
        return self

    async def close(self):
        with suppress(CancelledError):
            await self.cursor.close()
        await self.database.close()

    async def __aexit__(self, exc_type, exc_value, traceback):
        await self.close()

    def compatible(self):
        if (
            old := PROJECT_ROOT.parent.joinpath(self.__FILE)
        ).exists() and not self.file.exists():
            move(old, self.file)
