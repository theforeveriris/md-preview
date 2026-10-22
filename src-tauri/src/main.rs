// Windows 的 release 构建不弹控制台窗口；debug 保留控制台，方便看启动日志
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_external])
        .run(tauri::generate_context!())
        .expect("error while running md-preview");
}
