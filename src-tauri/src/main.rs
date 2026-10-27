// Windows 的 release 构建不弹控制台窗口；debug 保留控制台，方便看启动日志
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::Emitter;
// Watcher trait：notify 的 watch()/unwatch() 方法来源
use notify::Watcher;

/// 把外链交给系统默认浏览器。
///
/// 只放行 http(s)：这个命令对页面脚本开放，不能让它退化成「任意协议启动器」
/// （file://、ms-settings: 之类都不放行）。
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("only http(s) URLs are allowed".to_string());
    }
    open::that(url).map_err(|e| e.to_string())
}

// ============== 本地知识库（桌面端挂载本地文件夹） ==============

/// 目录树节点。path 为相对 root 的正斜杠路径；modified 为 epoch 秒。
/// title/tags/词数等富元数据由前端读文件后补齐，Rust 只做目录遍历。
#[derive(Serialize)]
struct KbNode {
    name: String,
    #[serde(rename = "type")]
    node_type: String, // "folder" | "file"
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    modified: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<KbNode>>,
}

/// 遍历跳过的目录：隐藏目录与依赖/构建产物（挂载本仓库也不会扫进大海）
const KB_SKIP_DIRS: &[&str] = &[
    "node_modules", "dist", "target", "__pycache__", ".git", ".github",
    ".vscode", ".idea", "vendor", "iris", "node_modules.bak",
];
const KB_MAX_FILES: usize = 2000;
const KB_MAX_DEPTH: usize = 12;
/// 单文件读取上限：Markdown 文档超过 8MB 基本是误挂载的数据文件
const KB_MAX_FILE_BYTES: u64 = 8 * 1024 * 1024;

fn modified_secs(p: &Path) -> Option<i64> {
    p.metadata().ok()?.modified().ok()?
        .duration_since(UNIX_EPOCH).ok()
        .map(|d| d.as_secs() as i64)
}

fn walk_kb(dir: &Path, rel_prefix: &str, depth: usize, count: &mut usize) -> Vec<KbNode> {
    if depth > KB_MAX_DEPTH || *count >= KB_MAX_FILES {
        return Vec::new();
    }
    let mut folders: Vec<(PathBuf, String)> = Vec::new();
    let mut files: Vec<(PathBuf, String)> = Vec::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if path.is_dir() {
            if name.starts_with('.') || KB_SKIP_DIRS.contains(&name.as_str()) {
                continue;
            }
            folders.push((path, name));
        } else if name.to_lowercase().ends_with(".md") {
            files.push((path, name));
        }
    }
    // 目录在前，同类型按名称排序（前端 name-sort 只对展示排序，这里保证结构稳定）
    folders.sort_by(|a, b| a.1.to_lowercase().cmp(&b.1.to_lowercase()));
    files.sort_by(|a, b| a.1.to_lowercase().cmp(&b.1.to_lowercase()));

    let mut nodes = Vec::new();
    for (path, name) in folders {
        let rel = if rel_prefix.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", rel_prefix, name)
        };
        let children = walk_kb(&path, &rel, depth + 1, count);
        nodes.push(KbNode {
            name,
            node_type: "folder".to_string(),
            path: rel,
            modified: None,
            children: Some(children),
        });
    }
    for (path, name) in files {
        if *count >= KB_MAX_FILES {
            break;
        }
        *count += 1;
        let rel = if rel_prefix.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", rel_prefix, name)
        };
        nodes.push(KbNode {
            name,
            node_type: "file".to_string(),
            path: rel,
            modified: modified_secs(&path),
            children: None,
        });
    }
    nodes
}

/// 弹出系统目录选择框（AsyncFileDialog 内部自行派发到正确的平台线程）
#[tauri::command(async)]
async fn pick_folder() -> Result<Option<String>, String> {
    let picked = rfd::AsyncFileDialog::new()
        .set_title("选择要挂载为知识库的文件夹")
        .pick_folder()
        .await;
    Ok(picked.and_then(|handle| handle.path().to_str().map(|s| s.to_string())))
}

/// 遍历目录返回文件树 JSON（.md 文件 + 目录骨架）
#[tauri::command]
fn read_kb_tree(root: String) -> Result<String, String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err("not a directory".to_string());
    }
    let mut count = 0usize;
    let tree = walk_kb(&root_path, "", 0, &mut count);
    serde_json::to_string(&tree).map_err(|e| e.to_string())
}

/// 归一化并校验 KB 相对路径：拒绝绝对路径与 .. 穿越后拼进 root
fn resolve_kb_path(root: &Path, rel: &str) -> Result<PathBuf, String> {
    if rel.is_empty() {
        return Err("empty path".to_string());
    }
    let mut out = root.to_path_buf();
    for seg in rel.split('/') {
        if seg.is_empty() || seg == "." {
            continue;
        }
        if seg == ".." {
            return Err("path traversal is not allowed".to_string());
        }
        out.push(seg);
    }
    Ok(out)
}

/// 读取挂载目录内的单个文件（路径限定在 root 内，拒绝穿越）
#[tauri::command]
fn read_kb_file(root: String, path: String) -> Result<String, String> {
    let root_path = PathBuf::from(&root);
    let target = resolve_kb_path(&root_path, &path)?;
    if !target.is_file() {
        return Err("not a file".to_string());
    }
    let meta = target.metadata().map_err(|e| e.to_string())?;
    if meta.len() > KB_MAX_FILE_BYTES {
        return Err("file too large".to_string());
    }
    // canonicalize 二次校验：符号链接等路径花招也逃不出 root
    let canonical_root = root_path.canonicalize().map_err(|e| e.to_string())?;
    let canonical_target = target.canonicalize().map_err(|e| e.to_string())?;
    if !canonical_target.starts_with(&canonical_root) {
        return Err("path escapes mounted root".to_string());
    }
    std::fs::read_to_string(&target)
        .map_err(|e| format!("read failed: {}", e))
}

// ============== 文件关联 + 实时预览 ==============

/// 挂载目录的文件系统监视器（同一时刻只 watch 一个根，重新挂载即替换）
struct KbWatchState(Mutex<Option<notify::RecommendedWatcher>>);

/// 双击 .md 打开的文件参数：Rust 启动时从 argv 捕获，前端就绪后取走
struct OpenFileArg(Mutex<Option<String>>);

fn is_md_path(p: &Path) -> bool {
    p.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("md") || e.eq_ignore_ascii_case("markdown"))
        .unwrap_or(false)
}

/// 监视挂载根目录，.md 变更时向前端发 kb-changed（值为变更文件的绝对路径）
#[tauri::command]
fn watch_kb_folder(
    app: tauri::AppHandle,
    root: String,
    state: tauri::State<KbWatchState>,
) -> Result<(), String> {
    let root_path = PathBuf::from(&root);
    if !root_path.is_dir() {
        return Err("not a directory".to_string());
    }
    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        if let Ok(event) = res {
            for p in event.paths {
                if is_md_path(&p) {
                    let _ = app.emit("kb-changed", p.to_string_lossy().to_string());
                }
            }
        }
    })
    .map_err(|e| e.to_string())?;
    watcher
        .watch(&root_path, notify::RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    *state.0.lock().unwrap() = Some(watcher);
    Ok(())
}

/// 卸载知识库时停止监视
#[tauri::command]
fn unwatch_kb_folder(state: tauri::State<KbWatchState>) -> Result<(), String> {
    *state.0.lock().unwrap() = None;
    Ok(())
}

/// 前端就绪后取走启动参数里的 .md 路径（一次性；事件先于 JS 监听建立，
/// 所以用取件箱模式而不是启动期 emit）
#[tauri::command]
fn take_open_file_arg(state: tauri::State<OpenFileArg>) -> Result<Option<String>, String> {
    Ok(state.0.lock().unwrap().take())
}

/// 读取通过文件关联打开的外部 .md 文件（限 md/markdown 扩展名与大小上限）
#[tauri::command]
fn read_open_file(path: String) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.is_file() || !is_md_path(&p) {
        return Err("not a markdown file".to_string());
    }
    let meta = p.metadata().map_err(|e| e.to_string())?;
    if meta.len() > KB_MAX_FILE_BYTES {
        return Err("file too large".to_string());
    }
    std::fs::read_to_string(&p).map_err(|e| format!("read failed: {}", e))
}

/// 启动参数捕获：Windows 文件关联会把文档路径作为 argv 传入
fn capture_open_file_arg() -> Option<String> {
    std::env::args().skip(1).find(|arg| {
        let p = PathBuf::from(arg);
        p.is_file() && is_md_path(&p)
    })
}

// ============== 桌面端自动更新 ==============
//
// 前端不直接调 updater 插件的 IPC 命令（资源句柄协议需要官方 JS 绑定配合），
// 而是用本 crate 包装两个命令：check_update 返回版本信息，install_update
// 从状态里取回 Update 对象下载安装（Windows 上安装完自动重启）。

use tauri_plugin_updater::UpdaterExt;

/// check_update 暂存的待安装更新，install_update 消费
struct PendingUpdate(Mutex<Option<tauri_plugin_updater::Update>>);

#[derive(Serialize)]
struct UpdateInfo {
    version: String,
    notes: String,
}

#[tauri::command(async)]
async fn check_update(
    app: tauri::AppHandle,
    pending: tauri::State<'_, PendingUpdate>,
) -> Result<Option<UpdateInfo>, String> {
    let update = app
        .updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;
    let Some(update) = update else {
        *pending.0.lock().unwrap() = None;
        return Ok(None);
    };
    let info = UpdateInfo {
        version: update.version.clone(),
        notes: update.body.clone().unwrap_or_default(),
    };
    *pending.0.lock().unwrap() = Some(update);
    Ok(Some(info))
}

/// 下载并安装待更新（进度经 updater-progress 事件通知前端；完成后应用自动重启）
#[tauri::command(async)]
async fn install_update(
    app: tauri::AppHandle,
    pending: tauri::State<'_, PendingUpdate>,
) -> Result<(), String> {
    let update = pending
        .0
        .lock()
        .unwrap()
        .take()
        .ok_or("no pending update")?;
    update
        .download_and_install(
            |chunk, total| {
                let _ = app.emit("updater-progress", (chunk, total));
            },
            || {
                let _ = app.emit("updater-downloaded", ());
            },
        )
        .await
        .map_err(|e| e.to_string())
}

fn main() {
    let open_arg = capture_open_file_arg();
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(KbWatchState(Mutex::new(None)))
        .manage(OpenFileArg(Mutex::new(open_arg)))
        .manage(PendingUpdate(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_external,
            pick_folder,
            read_kb_tree,
            read_kb_file,
            watch_kb_folder,
            unwatch_kb_folder,
            take_open_file_arg,
            read_open_file,
            check_update,
            install_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running md-preview");
}
