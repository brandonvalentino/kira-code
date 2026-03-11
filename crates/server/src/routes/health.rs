use aide::axum::{ApiRouter, routing::get};
use axum::response::Json;
use utils::response::ApiResponse;

use crate::DeploymentImpl;

pub async fn health_check() -> Json<ApiResponse<String>> {
    Json(ApiResponse::success("OK".to_string()))
}

pub fn router() -> ApiRouter<DeploymentImpl> {
    ApiRouter::new()
        .api_route("/health", get(health_check))
        .with_path_items(|p| p.tag("health"))
        .with_path_items(|p| p.tag("health"))
}
pub fn router_for_spec() -> ApiRouter<DeploymentImpl> {
    router()
}
