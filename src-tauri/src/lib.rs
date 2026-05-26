use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[derive(Serialize)]
struct BackupResult {
  ok: bool,
  file_name: String,
  backup_path: String,
  backup_dir: String,
  size_bytes: u64,
  copied_sidecars: Vec<String>,
  created_epoch: u64,
}

#[derive(Serialize)]
struct BackupEntry {
  file_name: String,
  path: String,
  size_bytes: u64,
  modified_epoch: u64,
}

#[derive(Serialize)]
struct BackupFolderResult {
  ok: bool,
  backup_dir: String,
}

fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  app.path().app_data_dir().map_err(|err| format!("Impossibile leggere app data dir: {err}"))
}

fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let dir = app_data_dir(app)?.join("backups");
  fs::create_dir_all(&dir).map_err(|err| format!("Impossibile creare cartella backup: {err}"))?;
  Ok(dir)
}

fn epoch_now() -> Result<u64, String> {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_secs())
    .map_err(|err| format!("Ora sistema non valida: {err}"))
}

fn prune_old_backups(dir: &PathBuf, keep: usize) {
  let mut entries: Vec<(PathBuf, u64)> = match fs::read_dir(dir) {
    Ok(read_dir) => read_dir
      .filter_map(|entry| entry.ok())
      .filter_map(|entry| {
        let path = entry.path();
        let name = path.file_name()?.to_string_lossy().to_string();
        if !name.ends_with(".sqlite") || !name.starts_with("barai_") {
          return None;
        }
        let modified = entry
          .metadata()
          .ok()
          .and_then(|m| m.modified().ok())
          .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
          .map(|d| d.as_secs())
          .unwrap_or(0);
        Some((path, modified))
      })
      .collect(),
    Err(_) => return,
  };
  entries.sort_by(|a, b| b.1.cmp(&a.1));
  for (path, _) in entries.into_iter().skip(keep) {
    let _ = fs::remove_file(path);
  }
}

#[tauri::command]
fn create_local_db_backup(app: tauri::AppHandle, reason: Option<String>) -> Result<BackupResult, String> {
  let data_dir = app_data_dir(&app)?;
  let source = data_dir.join("barai.sqlite");
  if !source.exists() {
    return Err(format!("Database locale non trovato: {}", source.to_string_lossy()));
  }

  let dir = backup_dir(&app)?;
  let epoch = epoch_now()?;
  let clean_reason = reason
    .unwrap_or_else(|| "manuale".to_string())
    .chars()
    .map(|c| if c.is_ascii_alphanumeric() { c.to_ascii_lowercase() } else { '_' })
    .collect::<String>()
    .trim_matches('_')
    .to_string();
  let suffix = if clean_reason.is_empty() { "manuale" } else { clean_reason.as_str() };
  let file_name = format!("barai_{}_{}.sqlite", epoch, suffix);
  let destination = dir.join(&file_name);

  fs::copy(&source, &destination).map_err(|err| format!("Backup SQLite fallito: {err}"))?;
  let size_bytes = fs::metadata(&destination).map(|m| m.len()).unwrap_or(0);
  if size_bytes == 0 {
    let _ = fs::remove_file(&destination);
    return Err("Backup creato ma vuoto: operazione annullata.".to_string());
  }

  let mut copied_sidecars = Vec::new();
  for ext in ["sqlite-wal", "sqlite-shm"] {
    let sidecar = data_dir.join(format!("barai.{ext}"));
    if sidecar.exists() {
      let dest_name = format!("barai_{}_{}.{}", epoch, suffix, ext.replace("sqlite-", ""));
      let sidecar_dest = dir.join(&dest_name);
      if fs::copy(&sidecar, &sidecar_dest).is_ok() {
        copied_sidecars.push(dest_name);
      }
    }
  }

  prune_old_backups(&dir, 30);

  Ok(BackupResult {
    ok: true,
    file_name,
    backup_path: destination.to_string_lossy().to_string(),
    backup_dir: dir.to_string_lossy().to_string(),
    size_bytes,
    copied_sidecars,
    created_epoch: epoch,
  })
}

#[tauri::command]
fn list_local_db_backups(app: tauri::AppHandle) -> Result<Vec<BackupEntry>, String> {
  let dir = backup_dir(&app)?;
  let mut entries: Vec<BackupEntry> = fs::read_dir(&dir)
    .map_err(|err| format!("Impossibile leggere cartella backup: {err}"))?
    .filter_map(|entry| entry.ok())
    .filter_map(|entry| {
      let path = entry.path();
      let file_name = path.file_name()?.to_string_lossy().to_string();
      if !file_name.starts_with("barai_") || !file_name.ends_with(".sqlite") {
        return None;
      }
      let metadata = entry.metadata().ok()?;
      let modified_epoch = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
      Some(BackupEntry {
        file_name,
        path: path.to_string_lossy().to_string(),
        size_bytes: metadata.len(),
        modified_epoch,
      })
    })
    .collect();
  entries.sort_by(|a, b| b.modified_epoch.cmp(&a.modified_epoch));
  Ok(entries)
}

#[tauri::command]
fn open_local_backup_folder(app: tauri::AppHandle) -> Result<BackupFolderResult, String> {
  let dir = backup_dir(&app)?;
  #[cfg(target_os = "macos")]
  let status = std::process::Command::new("open").arg(&dir).status();
  #[cfg(target_os = "windows")]
  let status = std::process::Command::new("explorer").arg(&dir).status();
  #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
  let status = std::process::Command::new("xdg-open").arg(&dir).status();

  match status {
    Ok(_) => Ok(BackupFolderResult { ok: true, backup_dir: dir.to_string_lossy().to_string() }),
    Err(err) => Err(format!("Impossibile aprire cartella backup: {err}. Percorso: {}", dir.to_string_lossy())),
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![
      create_local_db_backup,
      list_local_db_backups,
      open_local_backup_folder
    ])
    .run(tauri::generate_context!())
    .expect("error while running BarAI Desktop");
}
