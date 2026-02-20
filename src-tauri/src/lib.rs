use tauri::Manager as _;

/// Read a file dropped onto the window from its filesystem path.
/// Called by the frontend Tauri D&D bridge when a native file drop occurs.
/// Returns the file content as a UTF-8 string (text / markdown files).
#[tauri::command]
fn read_dropped_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read \"{path}\": {e}"))
}

/// Read a file as raw bytes (base64-encoded) for binary files (audio, images).
/// Returned as a base64 string so it can be decoded in the frontend without
/// dealing with ArrayBuffer serialisation over Tauri IPC.
#[tauri::command]
fn read_dropped_file_bytes(path: String) -> Result<String, String> {
    let bytes =
        std::fs::read(&path).map_err(|e| format!("Failed to read \"{path}\": {e}"))?;
    Ok(base64_encode(&bytes))
}

/// Minimal base64 encoder — avoids pulling in a crate just for this.
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        out.push(CHARS[b0 >> 2] as char);
        out.push(CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        out.push(if chunk.len() > 1 { CHARS[((b1 & 15) << 2) | (b2 >> 6)] as char } else { '=' });
        out.push(if chunk.len() > 2 { CHARS[b2 & 63] as char } else { '=' });
    }
    out
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_dropped_file,
            read_dropped_file_bytes,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running storie");
}
