use std::{fs, path::Path};

use aide::openapi::OpenApi;

fn main() {
    aide::generate::on_error(|e| eprintln!("aide schema error: {e}"));
    aide::generate::extract_schemas(true);

    let mut api = OpenApi {
        info: aide::openapi::Info {
            title: "Kira Code API".to_string(),
            version: "0.1.0".to_string(),
            ..Default::default()
        },
        ..Default::default()
    };

    server::openapi::build_api(&mut api);

    let json = serde_json::to_string_pretty(&api).expect("serialize");
    let path = Path::new("shared/openapi.json");
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, json).unwrap();
    println!("Written to shared/openapi.json");
}
