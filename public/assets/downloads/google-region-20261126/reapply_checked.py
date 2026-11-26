#!/usr/bin/env python3
"""REA 本机改进版：macOS arm64，默认只读，只在指定新副本中修改。

仅支持已验证的 Go/ARM64 指令形态，遇到未知结构拒绝写入。
不安装、不退出其他进程、不更改账号、不创建自动更新任务。
依赖：Python 3.9+ 标准库；生成副本时需要 macOS codesign。
"""
import argparse
import hashlib
import json
import pathlib
import plistlib
import shutil
import struct
import subprocess
import sys

VERSION = "1.0.0"
TARGET = "authclient.ValidateAndOnboardAccount"
VALIDATION = "(*IneligibleTier).GetValidationUrl"
PREFIX = int.from_bytes(b"free-tie", "little")


class Rejected(ValueError):
    pass


def require(ok, message):
    if not ok:
        raise Rejected(message)


def word(data, off):
    require(0 <= off <= len(data)-4, "二进制范围越界")
    return struct.unpack_from("<I", data, off)[0]


def signed(value, bit_width):
    return value - (1 << bit_width) if value & (1 << (bit_width-1)) else value


def macho_text(data):
    require(len(data) >= 32 and word(data, 0) == 0xFEEDFACF, "仅支持单架构 64 位 Mach-O")
    require(word(data, 4) == 0x0100000C, "仅支持 macOS arm64，不支持 x86 或其他架构")
    count, size = struct.unpack_from("<II", data, 16)
    require(0 < count < 1024 and 32+size <= len(data), "Mach-O load commands 非法")
    off, sections = 32, []
    for _ in range(count):
        cmd, length = struct.unpack_from("<II", data, off)
        require(length >= 8 and off+length <= 32+size, "段命令超界")
        if cmd == 0x19:
            require(length >= 72, "段结构不完整")
            segname = data[off+8:off+24].rstrip(b"\0")
            vmaddr, vmsize, seg_off, seg_size = struct.unpack_from("<4Q", data, off+24)
            require(seg_off+seg_size <= len(data) and seg_size <= vmsize, "段文件范围非法")
            nsects = word(data, off+64)
            require(72+nsects*80 <= length, "节表超界")
            for n in range(nsects):
                sec = off+72+n*80
                if data[sec:sec+16].rstrip(b"\0") == b"__text":
                    address, text_size = struct.unpack_from("<QQ", data, sec+32)
                    file_off = word(data, sec+48)
                    require(segname == b"__TEXT" and data[sec+16:sec+32].rstrip(b"\0") == segname,
                            "text 节必须属于 __TEXT")
                    require(seg_size > 0 and seg_off <= file_off and file_off+text_size <= seg_off+seg_size,
                            "text 节超出所属文件段")
                    require(vmaddr <= address and address+text_size <= vmaddr+vmsize and
                            address-vmaddr == file_off-seg_off, "text 节虚拟地址与文件范围不一致")
                    sections.append((file_off, address, text_size))
        off += length
    require(len(sections) == 1, "不能唯一确定 __text")
    return sections[0]


def functions(data, text):
    text_off, text_addr, text_size = text
    valid = []
    for magic in (0xFFFFFFF1, 0xFFFFFFF0):
        pattern = struct.pack("<I", magic)+b"\0\0"
        search = 0
        while True:
            base = data.find(pattern, search)
            if base < 0:
                break
            search = base+1
            try:
                require(base+72 <= len(data) and data[base+6:base+8] == b"\x04\x08", "函数表架构不符")
                nfunc = struct.unpack_from("<Q", data, base+8)[0]
                start, fn_off, cu, ft, pc, pcln = struct.unpack_from("<6Q", data, base+24)
                # PIE Mach-O 的 textStart 在磁盘上可能为0，由加载器重定位。
                require(start in (0, text_addr) and 0 < nfunc < 500000, "函数表 textStart 不符")
                tab, names = base+pcln, base+fn_off
                require(72 <= fn_off < cu <= ft < pc < pcln and base+pcln < len(data),
                        "Go函数表各分区偏移非法")
                require(tab+8*(nfunc+1) <= len(data), "函数入口表超界")
                require(word(data, tab) == 0 and
                        word(data, text_off) & 0xFFC003FF == 0xF9400390,
                        "Go函数表不能与Mach-O text起点对应")
                entries, hits, previous = [], [], -1
                for n in range(nfunc):
                    entry, func_off = struct.unpack_from("<II", data, tab+n*8)
                    require(previous < entry < text_size and entry % 4 == 0, "函数地址顺序非法")
                    previous = entry
                    info = tab+func_off
                    require(tab+8*(nfunc+1) <= info and info+8 <= len(data) and
                            word(data, info) == entry, "函数记录入口不一致")
                    name_off = struct.unpack_from("<i", data, info+4)[0]
                    name_at = names+name_off
                    require(names <= name_at < base+cu, "函数名超界")
                    end = data.find(b"\0", name_at, min(base+cu, name_at+2048))
                    require(end > name_at, "函数名不完整")
                    name = data[name_at:end].decode("utf8", "strict")
                    entries.append((text_off+entry, name))
                    if name.endswith(TARGET):
                        hits.append(n)
                sentinel = word(data, tab+nfunc*8)
                # 最后一项是排他PC边界，部分Go汇编符号以 entry+1 结束，不是指令入口。
                require(previous < sentinel <= text_size,
                        "函数表终止入口非法")
                require(len(hits) == 1, "目标函数不唯一")
                index = hits[0]
                require(index+1 < nfunc, "目标函数边界缺失")
                valid.append((entries[index][0], entries[index+1][0], dict(entries)))
            except (Rejected, struct.error, UnicodeError):
                continue
    require(len(valid) == 1, "找不到唯一且有效的 Go 函数表／目标函数")
    return valid[0]


def branch(data, off, ne_only=False):
    w = word(data, off)
    if w & 0xFF00001F == 0x54000001:
        return off+signed((w >> 5) & 0x7FFFF, 19)*4, "b.ne"
    if not ne_only and w & 0xFC000000 == 0x14000000:
        return off+signed(w & 0x3FFFFFF, 26)*4, "b"
    raise Rejected("分支不是预期的 b.ne 或已应用的 b")


def cmp_immediate(w, value, wide=True):
    opcode = (0xF100001F if wide else 0x7100001F) | (value << 10)
    return (w & ~0x3E0) == opcode


def reaches_validation(data, tail, end, symbols):
    """在限定窗口里，所有直接控制流路径都必须到达类型标记调用。"""
    limit = min(end, tail+80)
    memo, active = {}, set()
    def walk(pos):
        if not tail <= pos < limit or pos % 4 or pos in active:
            return False
        if pos in memo:
            return memo[pos]
        active.add(pos)
        w = word(data, pos)
        if w & 0xFC000000 == 0x94000000:
            dest = pos+signed(w & 0x3FFFFFF, 26)*4
            ok = symbols.get(dest, "").endswith(VALIDATION) or walk(pos+4)
        elif w & 0xFC000000 == 0x14000000:
            ok = walk(pos+signed(w & 0x3FFFFFF, 26)*4)
        elif w & 0xFF000010 == 0x54000000 or w & 0x7E000000 == 0x34000000:
            ok = walk(pos+signed((w >> 5) & 0x7FFFF, 19)*4) and walk(pos+4)
        elif w & 0x7E000000 == 0x36000000:
            ok = walk(pos+signed((w >> 5) & 0x3FFF, 14)*4) and walk(pos+4)
        elif w & 0xFE000000 == 0xD6000000:
            ok = False
        else:
            ok = walk(pos+4)
        active.remove(pos)
        memo[pos] = ok
        return ok
    return walk(tail)


def free_tier(data, at, start, end, symbols):
    """核对长度9、完整free-tier、三条同目标分支、以及紧邻的IneligibleTier调用。"""
    require(cmp_immediate(word(data, at), 9), "不是长度为9的比较")
    loop, status = branch(data, at+4)
    require(start <= loop < at and loop % 4 == 0, "回跳不在当前函数")
    off = at+8
    w = word(data, off)
    require(w & 0xFFC00000 == 0xF9400000 and ((w >> 10) & 0xFFF) == 0, "缺少字符串前8字节读取")
    ptr, value_reg = (w >> 5) & 31, w & 31
    off += 4
    # 限定连续MOVZ/MOVK序列，避免只凭常量或9字节长度猜分支。
    constant, const_reg, shifts = 0, None, []
    for n in range(4):
        w = word(data, off)
        kind = w & 0xFF800000
        require(kind == (0xD2800000 if n == 0 else 0xF2800000), "常量构造形态未支持")
        reg, shift = w & 31, ((w >> 21) & 3)*16
        require((const_reg is None or reg == const_reg) and shift not in shifts, "常量寄存器或位段不符")
        const_reg = reg
        shifts.append(shift)
        constant = (constant & ~(0xFFFF << shift)) | (((w >> 5) & 0xFFFF) << shift)
        off += 4
    require(constant == PREFIX and set(shifts) == {0, 16, 32, 48}, "没有完整匹配 free-tie")
    require(const_reg not in (ptr, value_reg), "字符串常量覆盖数据寄存器")
    w = word(data, off)
    require(w & 0xFFE0FC1F == 0xEB00001F and
            (w >> 5) & 31 == value_reg and (w >> 16) & 31 == const_reg, "字符串内容比较不符")
    off += 4
    require(branch(data, off, True)[0] == loop, "前8字节失败不回同一循环")
    off += 4
    w = word(data, off)
    require(w & 0xFFC00000 == 0x39400000 and (w >> 5) & 31 == ptr and
            (w >> 10) & 0xFFF == 8, "缺少第9字节读取")
    byte_reg = w & 31
    off += 4
    require(cmp_immediate(word(data, off), ord("r"), False) and
            (word(data, off) >> 5) & 31 == byte_reg, "第9字节不是 r")
    off += 4
    require(branch(data, off, True)[0] == loop, "第9字节失败不回同一循环")
    tail = off+4
    require(reaches_validation(data, tail, end, symbols),
            "不能证明所有后续路径到达 IneligibleTier 类型调用")
    return {"comparison": hex(at), "branch": hex(at+4), "loop": hex(loop),
            "status": "already_applied" if status == "b" else "needs_patch",
            "proof": ["free-tier 完整字符串", "同函数内回跳", "IneligibleTier.GetValidationUrl"],
            "length_register": "x"+str((word(data, at) >> 5) & 31)}


def inspect(path):
    raw = path.read_bytes()
    text = macho_text(raw)
    start, end, symbols = functions(raw, text)
    require(0 < end-start < 65536, "函数大小异常")
    sites = []
    for at in range(start, end-64, 4):
        if not cmp_immediate(word(raw, at), 9):
            continue
        try:
            sites.append(free_tier(raw, at, start, end, symbols))
        except Rejected:
            continue
    require(len(sites) == 1, f"语义候选应为1处，实际{len(sites)}处；不修改")
    site = sites[0]
    extra = []
    for at in range(start, end-8, 4):
        if cmp_immediate(word(raw, at), 9) and at+4 != int(site["branch"], 16):
            try:
                target, kind = branch(raw, at+4)
                if kind == "b" and start <= target < at:
                    extra.append(hex(at+4))
            except Rejected:
                pass
    result = {
        "tool_version": VERSION, "source": str(path), "sha256": hashlib.sha256(raw).hexdigest(),
        "function": TARGET, "function_start": hex(start), "function_end": hex(end),
        "text_offset": hex(text[0]), **site,
        "other_modified_length9_branches": extra,
        "warning": "源文件还有其他修改，不提供自动撤销或重新生成" if extra else "",
    }
    return result, raw


def command(argv):
    r = subprocess.run(argv, capture_output=True, timeout=60)
    require(r.returncode == 0, r.stderr.decode("utf8", "replace")[-2000:])
    return r.stdout


def sign(path, entfile, runtime=False):
    r = subprocess.run(["codesign", "-d", "--entitlements", "-", "--xml", str(path)],
                       capture_output=True, timeout=20)
    require(r.returncode == 0, "原签名权限读取失败，停止，不使用空权限代替")
    try:
        entitlements = plistlib.loads(r.stdout) if r.stdout.strip() else {}
    except plistlib.InvalidFileException:
        raise Rejected("不能读取原签名权限；停止，不丢弃未知权限")
    require(isinstance(entitlements, dict), "权限格式异常")
    require(not entfile.exists(), "签名权限文件已经存在")
    entfile.write_bytes(plistlib.dumps(entitlements))
    flags = ["--options", "runtime"] if runtime else []
    command(["codesign", "--force", "--sign", "-", *flags, "--entitlements", str(entfile), str(path)])
    command(["codesign", "--verify", "--strict", str(path)])


def stage(source, output, result, raw):
    output = output.parent.resolve()/output.name
    require(not output.exists() and not output.is_symlink(), "输出已存在；拒绝覆盖")
    require(output.parent.is_dir(), "输出父目录不存在")
    require(source != output and source not in output.parents, "输出不能是源文件或其内部")
    require(not result["other_modified_length9_branches"], "源有额外分支修改；需原版，拒绝猜测恢复")
    bundle = source.is_dir()
    command(["codesign", "--verify", "--strict",
             str(source/"Contents/Resources/bin/language_server" if bundle else source)])
    if bundle:
        require(output.suffix == ".app", "App 副本需使用 .app 后缀")
        shutil.copytree(source, output, symlinks=True)
        dest = output/"Contents/Resources/bin/language_server"
    else:
        shutil.copy2(source, output)
        dest = output
    if bundle:
        require_safe_bundle_binary(output, dest)
    require(dest.read_bytes() == raw, "复制后的文件与来源不一致")
    before_sign = bytearray(raw)
    if result["status"] == "needs_patch":
        off, loop = int(result["branch"], 16), int(result["loop"], 16)
        new = 0x14000000 | (((loop-off)//4) & 0x3FFFFFF)
        struct.pack_into("<I", before_sign, off, new)
        require(raw[:off] == before_sign[:off] and raw[off+4:] == before_sign[off+4:] and
                raw[off:off+4] != before_sign[off:off+4],
                "修改超出唯一4字节指令")
        dest.write_bytes(before_sign)
    result["changed_instruction_bytes"] = 4 if result["status"] == "needs_patch" else 0
    result["pre_sign_sha256"] = hashlib.sha256(before_sign).hexdigest()
    sign(dest, output.parent/(output.name+".binary.entitlements.plist"), runtime=bundle)
    if bundle:
        sign(output, output.parent/(output.name+".app.entitlements.plist"))
    verified, _ = inspect(dest)
    require(verified["status"] == "already_applied" and not verified["other_modified_length9_branches"],
            "签名后指令验证失败")
    require(hashlib.sha256((source/"Contents/Resources/bin/language_server" if bundle else source).read_bytes()).hexdigest()
            == result["sha256"], "来源被改变")
    result.update(output=str(output), output_binary_sha256=verified["sha256"],
                  codesign_verified=True, source_unchanged=True, candidate_only=True)
    return result


def require_safe_bundle_binary(bundle, binary):
    require(bundle.resolve() in binary.resolve().parents, "App 二进制实际路径不属于源 bundle")
    current = bundle
    for part in binary.relative_to(bundle).parts:
        current = current/part
        require(not current.is_symlink(), "App 二进制路径含符号链接，拒绝跟随写入")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="原始 .app bundle 或独立 CLI")
    parser.add_argument("--output", help="不存在的新副本路径；省略则只检查")
    parser.add_argument("--report", help="保存本次 JSON 结果")
    args = parser.parse_args()
    result = {}
    report_path = None
    try:
        given = pathlib.Path(args.source).expanduser()
        require(given.exists() and not given.is_symlink(), "来源不存在或是符号链接")
        source = given.resolve()
        binary = source/"Contents/Resources/bin/language_server" if source.is_dir() else source
        require(binary.is_file() and not binary.is_symlink(), "来源二进制不存在或是符号链接")
        if source.is_dir():
            require_safe_bundle_binary(source, binary)
        if args.report:
            report_path = pathlib.Path(args.report).expanduser().absolute()
            resolved = report_path.parent.resolve()/report_path.name
            require(resolved.suffix == ".json" and resolved.parent.is_dir() and not resolved.exists()
                    and not resolved.is_symlink(), "报告必须是不存在的新 .json 文件")
            require(resolved != source and resolved != binary and source not in resolved.parents,
                    "报告不能写入源对象")
            if args.output:
                output = pathlib.Path(args.output).expanduser().absolute()
                output = output.parent.resolve()/output.name
                require(resolved != output, "报告与输出副本路径不能相同")
            report_path = resolved
        result, raw = inspect(binary)
        if source.is_dir():
            info = plistlib.loads((source/"Contents/Info.plist").read_bytes())
            result["app_version"] = info.get("CFBundleShortVersionString")
        if args.output:
            result = stage(source, pathlib.Path(args.output).expanduser().absolute(), result, raw)
        result["ok"] = True
        rc = 0
    except (Rejected, OSError, ValueError, struct.error, subprocess.TimeoutExpired) as exc:
        result.update(ok=False, status="rejected", error=str(exc))
        rc = 2
    payload = json.dumps(result, ensure_ascii=False, indent=2)+"\n"
    if report_path and rc == 0:
        with report_path.open("x", encoding="utf8") as f:
            f.write(payload)
    print(payload, end="")
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
