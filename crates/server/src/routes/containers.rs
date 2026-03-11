use aide::axum::{ApiRouter, routing::get};
use axum::{
    extract::{Query, State},
    response::Json as ResponseJson,
};
use db::models::{
    requests::ContainerQuery,
    workspace::{Workspace, WorkspaceContext},
};
use deployment::Deployment;
use schemars::JsonSchema;
use serde::Serialize;
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

#[derive(Debug, Serialize, JsonSchema)]
pub struct ContainerInfo {
    pub attempt_id: Uuid,
}

pub async fn get_container_info(
    Query(query): Query<ContainerQuery>,
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<ContainerInfo>>, ApiError> {
    let info =
        Workspace::resolve_container_ref_by_prefix(&deployment.db().pool, &query.container_ref)
            .await
            .map_err(ApiError::Database)?;

    Ok(ResponseJson(ApiResponse::success(ContainerInfo {
        attempt_id: info.workspace_id,
    })))
}

pub async fn get_context(
    State(deployment): State<DeploymentImpl>,
    Query(payload): Query<ContainerQuery>,
) -> Result<ResponseJson<ApiResponse<WorkspaceContext>>, ApiError> {
    let info =
        Workspace::resolve_container_ref_by_prefix(&deployment.db().pool, &payload.container_ref)
            .await
            .map_err(ApiError::Database)?;

    let ctx = Workspace::load_context(&deployment.db().pool, info.workspace_id).await?;
    Ok(ResponseJson(ApiResponse::success(ctx)))
}

pub fn router(_deployment: &DeploymentImpl) -> ApiRouter<DeploymentImpl> {
    ApiRouter::new()
        // NOTE: /containers/info is required by the VSCode extension (kira-code-vscode)
        // to auto-detect workspaces. It maps workspace_id to attempt_id for compatibility.
        // Do not remove this endpoint without updating the extension.
        .api_route("/containers/info", get(get_container_info))
        .api_route("/containers/attempt-context", get(get_context))
}

pub fn router_for_spec() -> ApiRouter<DeploymentImpl> {
    ApiRouter::new()
        .api_route("/containers/info", get(get_container_info))
        .api_route("/containers/attempt-context", get(get_context))
}
