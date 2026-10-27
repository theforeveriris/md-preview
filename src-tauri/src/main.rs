// Windows 的 release 构建不弹控制台窗口；debug 保留控制台，方便看启动日志
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::{Emitter, Manager};
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
    "node_modules",
    "dist",
    "target",
    "__pycache__",
    ".git",
    ".github",
    ".vscode",
    ".idea",
    "vendor",
    "iris",
    "node_modules.bak",
];
const KB_MAX_FILES: usize = 2000;
const KB_MAX_DEPTH: usize = 12;
/// 单文件读取上限：Markdown 文档超过 8MB 基本是误挂载的数据文件
const KB_MAX_FILE_BYTES: u64 = 8 * 1024 * 1024;

fn modified_secs(p: &Path) -> Option<i64> {
    p.metadata()
        .ok()?
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
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
    folders.sort_by_key(|a| a.1.to_lowercase());
    files.sort_by_key(|a| a.1.to_lowercase());

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

/// 知识库根目录：current = 当前挂载；previous = 上一次挂载（切换失败时回滚用）。
/// 根目录只在 Rust 侧通过系统目录对话框设置——前端无法指定任意路径
/// （CodeRabbit review fix：bind 由 pick_and_bind 一体完成，杜绝伪造）。
struct KbRootState {
    current: Mutex<Option<PathBuf>>,
    previous: Mutex<Option<PathBuf>>,
}

/// 弹出系统目录选择框并直接绑定为知识库根（一步完成，root 不经前端转手）。
/// 取消时返回 None 且不改动任何状态。
#[tauri::command(async)]
async fn pick_and_bind_kb(state: tauri::State<'_, KbRootState>) -> Result<Option<String>, String> {
    let picked = rfd::AsyncFileDialog::new()
        .set_title("选择要挂载为知识库的文件夹")
        .pick_folder()
        .await;
    let Some(handle) = picked else {
        return Ok(None);
    };
    let path = handle.path().to_path_buf();
    if !path.is_dir() {
        return Err("not a directory".to_string());
    }
    // 非 UTF-8 路径无法回传前端：先转换、失败时报错且不动状态
    // （否则前端把返回的 None 当作取消，保留旧知识库而 Rust 侧已换根）
    let Some(path_str) = path.to_str().map(|s| s.to_string()) else {
        return Err("path is not valid UTF-8".to_string());
    };
    let mut current = state.current.lock().unwrap();
    let mut previous = state.previous.lock().unwrap();
    // 旧 root 存入 previous，供 rollback_kb_root 恢复
    *previous = current.take();
    *current = Some(path);
    Ok(Some(path_str))
}
/// 挂载流程失败时回滚到上一代 root（没有则清空）
#[tauri::command]
fn rollback_kb_root(state: tauri::State<KbRootState>) -> Result<(), String> {
    let mut current = state.current.lock().unwrap();
    let mut previous = state.previous.lock().unwrap();
    *current = previous.take();
    Ok(())
}

#[tauri::command]
fn unbind_kb_root(
    state: tauri::State<KbRootState>,
    watch: tauri::State<KbWatchState>,
) -> Result<(), String> {
    *state.current.lock().unwrap() = None;
    *state.previous.lock().unwrap() = None;
    *watch.0.lock().unwrap() = None;
    Ok(())
}

fn kb_root(state: &tauri::State<KbRootState>) -> Result<PathBuf, String> {
    state
        .current
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "kb root not bound".to_string())
}

/// 遍历挂载根目录返回文件树 JSON（.md 文件 + 目录骨架）
#[tauri::command]
fn read_kb_tree(state: tauri::State<KbRootState>) -> Result<String, String> {
    let root_path = kb_root(&state)?;
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

/// 读取挂载目录内的单个文件（路径限定在绑定的 root 内，拒绝穿越）。
/// 校验顺序：先 canonicalize（root 外与不存在的路径返回同一错误，
/// 不泄露「文件是否存在」），再做大小检查。
#[tauri::command]
fn read_kb_file(path: String, state: tauri::State<KbRootState>) -> Result<String, String> {
    let root_path = kb_root(&state)?;
    let target = resolve_kb_path(&root_path, &path)?;
    let canonical_root = root_path
        .canonicalize()
        .map_err(|_| "not a file".to_string())?;
    let canonical_target = target
        .canonicalize()
        .map_err(|_| "not a file".to_string())?;
    if !canonical_target.is_file() || !canonical_target.starts_with(&canonical_root) {
        return Err("not a file".to_string());
    }
    let meta = canonical_target
        .metadata()
        .map_err(|_| "not a file".to_string())?;
    if meta.len() > KB_MAX_FILE_BYTES {
        return Err("file too large".to_string());
    }
    // 读取 canonical_target（已校验的路径），避免 target 与校验之间被替换的
    // TOCTOU 窗口（CWE-367，CodeRabbit review fix）
    std::fs::read_to_string(&canonical_target).map_err(|e| format!("read failed: {}", e))
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
    state: tauri::State<KbWatchState>,
    root: tauri::State<KbRootState>,
) -> Result<(), String> {
    // 根目录用 Rust 侧绑定的值，不再从前端传入
    let root_path = kb_root(&root)?;
    let mut watcher =
        notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
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

/// 前端就绪后取走启动参数里的 .md 文件（一次性；事件先于 JS 监听建立，
/// 所以用取件箱模式而不是启动期 emit）。路径与内容一并返回：
/// 读取动作只发生在「启动参数捕获到的那个文件」上，前端无法指定任意路径。
#[derive(Serialize)]
struct OpenFilePayload {
    path: String,
    text: String,
}

#[tauri::command]
fn take_open_file(state: tauri::State<OpenFileArg>) -> Result<Option<OpenFilePayload>, String> {
    let arg = state.0.lock().unwrap().take();
    let Some(path) = arg else { return Ok(None) };
    let p = PathBuf::from(&path);
    if !p.is_file() || !is_md_path(&p) {
        return Ok(None);
    }
    let meta = p.metadata().map_err(|e| e.to_string())?;
    if meta.len() > KB_MAX_FILE_BYTES {
        return Ok(None);
    }
    let text = std::fs::read_to_string(&p).map_err(|e| format!("read failed: {}", e))?;
    Ok(Some(OpenFilePayload { path, text }))
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

// ============== 多窗口：编辑器独立窗口（第六轮） ==============
//
// 新开一个 WebviewWindow 加载同一份站点（同一 WebView 数据目录 →
// IndexedDB 天然共享），窗口 label=editor 时前端自动进入编辑器模式。

#[tauri::command(async)]
async fn open_editor_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window("editor") {
        let _ = existing.set_focus();
        return Ok(());
    }
    tauri::WebviewWindowBuilder::new(&app, "editor", tauri::WebviewUrl::App("index.html".into()))
        .title("md-preview · 编辑器")
        .inner_size(1240.0, 840.0)
        .min_inner_size(420.0, 420.0)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn main() {
    let open_arg = capture_open_file_arg();
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(KbRootState {
            current: Mutex::new(None),
            previous: Mutex::new(None),
        })
        .manage(KbWatchState(Mutex::new(None)))
        .manage(OpenFileArg(Mutex::new(open_arg)))
        .manage(PendingUpdate(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            open_external,
            pick_and_bind_kb,
            rollback_kb_root,
            unbind_kb_root,
            read_kb_tree,
            read_kb_file,
            watch_kb_folder,
            take_open_file,
            check_update,
            install_update,
            open_editor_window
        ])
        .run(tauri::generate_context!())
        .expect("error while running md-preview");
}
