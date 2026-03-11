use aide::axum::{ApiRouter, routing::get};
use api_types::Workspace;
use axum::{
    extract::{Path, State},
    response::Json as ResponseJson,
};
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

pub fn router() -> ApiRouter<DeploymentImpl> {
    ApiRouter::new().route(
        "/workspaces/by-local-id/{local_workspace_id}",
        get(get_workspace_by_local_id),
    )
}

async fn get_workspace_by_local_id(
    State(deployment): State<DeploymentImpl>,
    Path(local_workspace_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Workspace>>, ApiError> {
    let client = deployment.remote_client()?;
    let workspace = client.get_workspace_by_local_id(local_workspace_id).await?;
    Ok(ResponseJson(ApiResponse::success(workspace)))
}
