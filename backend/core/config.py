# -*- coding: utf-8 -*-
"""集中式配置解析：把「随机器/随用户而变」的环境绑定参数从代码里外置。

解析优先级（每个键独立）：
    环境变量  >  workbench.local.json  >  旧的分文件(supabase/kb.local.json)  >  平台默认

- 新增/迁移「环境绑定」参数（路径、盘符、密钥、主机白名单）统一放
  workbench.local.json（已 gitignore，不入库）；参考 workbench.local.json.example。
- 纯逻辑常量（如「日报保留 14 天」）不要放这里——那属于代码。
- 只用标准库，保持本项目「零第三方依赖」。
"""
import json
import os
import platform
import shutil
import tempfile

from backend.core.paths import ROOT  # *.local.json 配置钉在仓库根

IS_WIN = platform.system() == "Windows"


def _load_json(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


# 统一本地配置文件（缺失即为空 dict，全部回退平台默认）
_LOCAL = _load_json(os.path.join(ROOT, "workbench.local.json"))


def _first(*vals):
    for v in vals:
        if v:
            return v
    return None


def workspace():
    """WorkBuddy 工作区根目录（原硬编码 E:\\AITools\\workbuddy\\workspace）。"""
    default = os.path.join(os.path.expanduser("~"), ".workbuddy", "workspace")
    return _first(os.environ.get("WB_WORKSPACE"), _LOCAL.get("workspace"), default)


def ollama_exe():
    """Ollama 可执行文件路径：优先 PATH(shutil.which)，再配置，最后 None。

    配置值为 "auto"（或缺失）表示只靠 PATH 查找。
    """
    cfg = _LOCAL.get("ollamaExe")
    found = shutil.which("ollama")
    if found:
        return found
    if cfg and cfg != "auto":
        return cfg  # 交给调用方 os.path.isfile 判断是否真实存在
    return None


def diag_log():
    """sync 诊断日志路径（原硬编码 D:\\AIWork\\sync_diag.log）。

    默认放系统临时目录：跨平台、且在仓库外，避免被 runner 的 git clean 清掉。
    """
    return _first(
        os.environ.get("WB_DIAG_LOG"),
        _LOCAL.get("diagLog"),
        os.path.join(tempfile.gettempdir(), "wb_sync_diag.log"),
    )


def disks():
    """要探测占用的磁盘根路径列表（原硬编码 ("C:\\","D:\\")，仅 Windows）。"""
    cfg = _LOCAL.get("disks")
    if cfg:
        return list(cfg)
    return ["C:\\", "D:\\"] if IS_WIN else ["/"]


def supabase():
    """返回 (url, service_key)。兼容旧 supabase.local.json 与环境变量。"""
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    sb = _LOCAL.get("supabase") or {}
    url = url or sb.get("url") or ""
    key = key or sb.get("serviceKey") or sb.get("service_role") or ""
    if not url or not key:
        legacy = _load_json(os.path.join(ROOT, "supabase.local.json"))
        url = url or legacy.get("url", "")
        key = key or legacy.get("serviceKey") or legacy.get("service_role") or ""
    return url.rstrip("/"), key


def kb():
    """返回 (vault, deposit_root)。兼容旧 kb.local.json 与环境变量。"""
    vault = os.environ.get("KB_VAULT", "")
    deposit = os.environ.get("KB_DEPOSIT", "")
    k = _LOCAL.get("kb") or {}
    vault = vault or k.get("vault") or ""
    deposit = deposit or k.get("depositRoot") or ""
    if not vault:
        legacy = _load_json(os.path.join(ROOT, "kb.local.json"))
        vault = vault or legacy.get("vault", "")
        deposit = deposit or legacy.get("depositRoot", "")
    return (os.path.normpath(vault) if vault else ""), (os.path.normpath(deposit) if deposit else "")


def chat_allow_hosts():
    """AI 聊天代理目标主机白名单；空列表 = 不限制（保持旧行为）。"""
    cp = _LOCAL.get("chatProxy") or {}
    return list(cp.get("allowHosts") or [])
