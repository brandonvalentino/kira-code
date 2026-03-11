use aide::axum::{ApiRouter, routing::get};
use api_types::ListProjectStatusesResponse;
use axum::{
    extract::{Query, State},
    response::Json as ResponseJson,
};
use schemars::JsonSchema;
use serde::Deserialize;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

#[derive(Debug, Deserialize, JsonSchema)]
pub struct ListProjectStatusesQuery {
    pub project_id: Uuid,
}

pub fn router() -> ApiRouter<DeploymentImpl> {
    ApiRouter::new().route("/project-statuses", get(list_project_statuses))
}

async fn list_project_statuses(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListProjectStatusesQuery>,
) -> Result<ResponseJson<ApiResponse<ListProjectStatusesResponse>>, ApiError> {
    let client = deployment.remote_client()?;
    let response = client.list_project_statuses(query.project_id).await?;
    Ok(ResponseJson(ApiResponse::success(response)))
}
