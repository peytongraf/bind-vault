// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use std::io::Read;
use std::path::PathBuf;

#[tauri::command]
fn get_custom_css() -> Result<Option<String>, String> {
    println!("Running get_custom_css");
    let home_dir = dirs::home_dir().ok_or("Could not find home directory")?;
    let css_path: PathBuf = [home_dir.to_str().unwrap(), ".config/shortcuts/style.css"]
        .iter()
        .collect();

    if css_path.exists() {
        println!("Css path exists!");
        fs::read_to_string(css_path)
            .map(Some)
            .map_err(|err| err.to_string())
    } else {
        println!("Css path ({:?}) doesn't exist", css_path);
        Ok(None) // File does not exist
    }
}

#[tauri::command]
fn exit_app() {
    std::process::exit(0x0);
}

/// Parses keybind lines from the Hyprland config file.
fn parse_hyprland_keybinds(file_path: &PathBuf) -> Result<Vec<(String, String)>, String> {
    let mut content = String::new();
    fs::File::open(file_path)
        .map_err(|e| e.to_string())?
        .read_to_string(&mut content)
        .map_err(|e| e.to_string())?;

    let keybinds: Vec<(String, String)> = content
        .lines()
        .filter_map(|line| {
            let line = line.trim();

            // Ignore empty lines and comments
            if line.is_empty() || line.starts_with('#') {
                return None;
            }

            // Only process lines that start with "bind =" or "bindm ="
            if line.starts_with("bind =") || line.starts_with("bindm =") {
                if let Some((_, bind_line)) = line.split_once('=') {
                    let parts: Vec<&str> = bind_line.split(',').map(|s| s.trim()).collect();
                    if parts.len() >= 3 {
                        // Construct the bind (modifiers + key)
                        let modifiers = parts[0].replace("$", "").replace(" ", "+");
                        let key = parts[1];
                        let action = parts[2..].join(","); // Action includes everything after the second part
                        let bind = format!("{}+{}", modifiers, key);
                        return Some((action, bind));
                    }
                }

                println!("Skipping malformed line: {:?}", line);
            }

            None
        })
        .collect();

    Ok(keybinds)
}

/// Reads the Hyprland config file and returns its keybinds if the file exists.
fn get_hyprland_config() -> Result<Option<(String, Vec<(String, String)>)>, String> {
    let hyprland_config_path = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".config/hypr/hyprland.conf");

    if hyprland_config_path.exists() {
        println!("Hyprland config file found: {:?}", hyprland_config_path);
        let keybinds = parse_hyprland_keybinds(&hyprland_config_path)?;
        Ok(Some(("hyprland.conf".to_string(), keybinds)))
    } else {
        println!("Hyprland config file not found.");
        Ok(None)
    }
}

#[tauri::command]
fn get_keybind_files() -> Result<Vec<(String, Vec<(String, String)>)>, String> {
    let shortcuts_dir_path = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".config/shortcuts/keybinds");

    println!("Looking for keybind files in: {:?}", shortcuts_dir_path);

    if !shortcuts_dir_path.exists() {
        println!("Shortcuts directory does not exist. Creating it.");
        fs::create_dir_all(&shortcuts_dir_path).map_err(|e| e.to_string())?;
    }

    let mut files_data = Vec::new();

    // Process files in the shortcuts directory
    for entry in fs::read_dir(&shortcuts_dir_path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_file() {
            let mut file = fs::File::open(&path).map_err(|e| e.to_string())?;
            let mut content = String::new();
            file.read_to_string(&mut content)
                .map_err(|e| e.to_string())?;

            let keybinds: Vec<(String, String)> = content
                .lines()
                .filter_map(|line| {
                    let parts: Vec<&str> = line.split('=').collect();
                    if parts.len() == 2 {
                        Some((parts[0].to_string(), parts[1].to_string()))
                    } else {
                        println!("Skipping malformed line: {:?}", line);
                        None
                    }
                })
                .collect();

            let file_name = path
                .file_name()
                .and_then(|name| name.to_str())
                .ok_or_else(|| format!("Failed to get file name for {:?}", path))?;

            files_data.push((file_name.to_string(), keybinds));
        }
    }

    // Add Hyprland config keybinds if available
    if let Some(hyprland_data) = get_hyprland_config()? {
        files_data.push(hyprland_data);
    }

    Ok(files_data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_keybind_files,
            exit_app,
            get_custom_css
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
