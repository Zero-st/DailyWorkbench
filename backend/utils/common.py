# -*- coding: utf-8 -*-
"""跨脚本共享小工具：HTTP 抓取(含 SSL 降级)、日志落盘、GitHub Contents API 推送。

抽取自原先在 fetch_ai_daily / fetch_daily_news / sync / daily_ai / push_schedule
里各写一遍的重复实现（三次法则：已 ≥2 处且逻辑稳定，合并划算）。纯标准库。

注：frontmatter 解析故意不并入——export_data.fm() 与 server._kb_parse_fm()
语义不同（后者处理列表/引号/正文），强合并会引入错误抽象，得不偿失。
"""
import base64
import html
import json
import os
import re
import ssl
import sys
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET

# 抓公开资讯用的浏览器 UA（默认 python/curl UA 会被部分站点 403）
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

GITHUB_API = "https://api.github.com"


def http_get_json(url, timeout=25, ua=UA):
    """GET 一个返回 JSON 的 URL；带浏览器 UA；证书链异常时降级为不校验重试。

    数据均为公开只读资讯，降级可接受（原 fetch_* 的一致做法）。
    """
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return json.loads(r.read().decode("utf-8"))


def http_get_text(url, timeout=25, ua=UA):
    """GET 文本（HTML/XML/RSS/Atom）；带浏览器 UA；证书链异常时降级为不校验重试。

    与 http_get_json 同款降级策略（公开只读资讯），供 RSS/Atom 资讯源抓取器共用。
    """
    req = urllib.request.Request(url, headers={"User-Agent": ua, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl.create_default_context()) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:
        ctx = ssl._create_unverified_context()
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
            return r.read().decode("utf-8", "replace")


def _clean_summary(raw, maxlen=200):
    """把 RSS description / Atom content 里的 HTML 摘要清成纯文本一行。

    去 script/style、去标签、解实体、压空白，并剥掉 RSS/Atom 常见的尾部导流词
    （"查看全文" / Product Hunt 的 "Discussion | Link"），最后截断。
    """
    s = raw or ""
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?s)<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"\s+", " ", s).strip()  # 先压空白，导流词才能被下面按整串匹配剥掉
    for junk in ("Discussion | Link", "Discussion |", "| Link", "查看全文"):
        s = s.replace(junk, " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s[:maxlen]


def parse_feed(xml_text, limit=20):
    """解析 RSS 2.0 或 Atom feed，返回统一 item 列表 [{title, summary, url}]。

    命名空间无关（按 local-name 匹配），两种格式通吃：
      - RSS : channel/item(title / link 文本 / description)
      - Atom: feed/entry(title / link[rel=alternate]@href / content|summary)
    单条缺 title 则跳过；整体解析失败（非 XML/空）返回 []，供抓取器优雅劣化。
    """
    if not xml_text:
        return []
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return []

    def local(el):
        return el.tag.rsplit("}", 1)[-1].lower()

    out = []
    for it in root.iter():
        if local(it) not in ("item", "entry"):
            continue
        title = ""
        url = ""
        summary = ""
        alt = ""
        first_href = ""
        for ch in it:
            name = local(ch)
            if name == "title" and not title:
                title = (ch.text or "").strip()
            elif name == "link":
                href = ch.get("href")
                if href:  # Atom: <link href rel>
                    if (ch.get("rel") or "alternate") == "alternate" and not alt:
                        alt = href
                    if not first_href:
                        first_href = href
                elif ch.text and not url:  # RSS: <link>text</link>
                    url = ch.text.strip()
            elif name in ("description", "summary", "content") and not summary:
                summary = _clean_summary(ch.text or "")
        if not url:
            url = alt or first_href
        if title:
            out.append({"title": title, "summary": summary, "url": url})
        if len(out) >= limit:
            break
    return out


def write_json_atomic(path, obj, indent=2):
    """原子写 JSON：先写同目录临时文件，再 os.replace 覆盖目标。

    避免读者（前端轮询 data.json / 另一进程）读到「写了一半」的损坏文件——
    os.replace 在同一文件系统上是原子操作，读到的要么是旧内容要么是新内容。
    多进程/多通道并发写同一 data.json 时，最后一个 replace 胜出，不会互相截断。
    """
    tmp = "%s.tmp.%d" % (path, os.getpid())
    try:
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, indent=indent)
        os.replace(tmp, path)
    except Exception:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


def write_log(path, lines):
    """把日志行写入 path 并打印；stdout 编码不支持中文时安全降级。"""
    text = "\n".join(lines)
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(text + "\n")
    except Exception:
        pass
    try:
        print(text)
    except UnicodeEncodeError:
        enc = sys.stdout.encoding or "utf-8"
        print(text.encode(enc, errors="replace").decode(enc))


def github_api_request(method, url, token, data=None, retries=3, log=None):
    """GitHub REST 请求；PUT 409 抛给调用方重试；5xx 自动重试。log 为可选诊断回调。"""
    headers = {
        "Authorization": "Bearer %s" % token,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "workbuddy-sync",
    }
    payload = json.dumps(data).encode("utf-8") if data is not None else None
    if payload is not None:
        headers["Content-Type"] = "application/json"
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=payload, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read().decode("utf-8", "replace")
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as e:
            last = e
            detail = ""
            try:
                detail = e.read().decode("utf-8", "replace")
            except Exception:
                pass
            if log:
                log("API %s -> HTTP %d: %s" % (method, e.code, detail[:400]))
            if e.code == 409 and method == "PUT":
                raise  # 交给调用方用最新 sha 重试
            if e.code >= 500 and attempt < retries - 1:
                continue
            raise RuntimeError("GitHub API %s 失败 %d: %s" % (method, e.code, detail[:400]))
        except Exception as e:
            last = e
            if log:
                log("API %s 异常: %s" % (method, e))
            if attempt < retries - 1:
                continue
            raise
    if last:
        raise last


def github_push(token, relpath, msg, repo, base_dir, log=None, src_path=None):
    """把本地文件推送到 repo 的 relpath（Contents API）。成功返回 True。

    - 读取的本地文件为 src_path（缺省 base_dir/relpath），支持源名≠目标名。
    - 统一推送通道（唯一无交互依赖、长期实测成功）；并发 409 自动取最新 sha 重试一次。
    """
    def _log(m):
        if log:
            log(m)

    url = "%s/repos/%s/contents/%s" % (GITHUB_API, repo, relpath)
    try:
        cur = github_api_request("GET", url, token, log=log)
        sha = cur.get("sha") if isinstance(cur, dict) else None
    except Exception as e:
        _log("GET %s sha 失败: %s" % (relpath, e))
        sha = None
    with open(src_path or os.path.join(base_dir, relpath), "rb") as f:
        content = base64.b64encode(f.read()).decode("ascii")
    body = {"message": msg, "content": content}
    if sha:
        body["sha"] = sha
    try:
        github_api_request("PUT", url, token, data=body, log=log)
        _log("PUT %s 成功 (sha=%s)" % (relpath, sha or "new"))
        return True
    except RuntimeError as e:
        if "409" in str(e):  # 并发更新，取最新 sha 重试一次
            try:
                cur = github_api_request("GET", url, token, log=log)
                sha = cur.get("sha") if isinstance(cur, dict) else None
                if sha:
                    body["sha"] = sha
                    github_api_request("PUT", url, token, data=body, log=log)
                    _log("PUT %s 重试成功" % relpath)
                    return True
            except Exception as e2:
                _log("PUT %s 重试失败: %s" % (relpath, e2))
        _log("PUT %s 最终失败" % relpath)
        return False
