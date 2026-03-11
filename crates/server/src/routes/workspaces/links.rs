use aide::axum::{
    ApiRouter,
    routing::{delete, post},
};
use api_types::{CreateWorkspaceRequest, PullRequestStatus, UpsertPullRequestRequest};
use axum::{
    Extension, Json,
    extract::{Path as AxumPath, State},
    middleware::from_fn_with_state,
    response::Json as ResponseJson,
};
use db::models::{
    merge::{Merge, MergeStatus},
    workspace::Workspace,
};
use deployment::Deployment;
use schemars::JsonSchema;
use serde::Deserialize;
use services::services::{diff_stream, remote_client::RemoteClientError, remote_sync};
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError, middleware::load_workspace_middleware};

#[derive(Debug, Deserialize, JsonSchema)]
pub struct LinkWorkspaceRequest {
    pub project_id: Uuid,
    pub issue_id: Uuid,
}

pub async fn link_workspace(
    Extension(workspace): Extension<Workspace>,
    State(deployment): State<DeploymentImpl>,
    Json(payload): Json<LinkWorkspaceRequest>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let client = deployment.remote_client()?;

    let stats =
        diff_stream::compute_diff_stats(&deployment.db().pool, deployment.git(), &workspace).await;

    client
        .create_workspace(CreateWorkspaceRequest {
            project_id: payload.project_id,
            local_workspace_id: workspace.id,
            issue_id: payload.issue_id,
            name: workspace.name.clone(),
            archived: Some(workspace.archived),
            files_changed: stats.as_ref().map(|s| s.files_changed as i32),
            lines_added: stats.as_ref().map(|s| s.lines_added as i32),
            lines_removed: stats.as_ref().map(|s| s.lines_removed as i32),
        })
        .await?;

    {
        let pool = deployment.db().pool.clone();
        let ws_id = workspace.id;
        let client = client.clone();
        tokio::spawn(async move {
            let merges = match Merge::find_by_workspace_id(&pool, ws_id).await {
                Ok(m) => m,
                Err(e) => {
                    tracing::error!(
                        "Failed to fetch merges for workspace {} during link: {}",
                        ws_id,
                        e
                    );
                    return;
                }
            };
            for merge in merges {
                if let Merge::Pr(pr_merge) = merge {
                    let pr_status = match pr_merge.pr_info.status {
                        MergeStatus::Open => PullRequestStatus::Open,
                        MergeStatus::Merged => PullRequestStatus::Merged,
                        MergeStatus::Closed => PullRequestStatus::Closed,
                        MergeStatus::Unknown => continue,
                    };
                    remote_sync::sync_pr_to_remote(
                        &client,
                        UpsertPullRequestRequest {
                            url: pr_merge.pr_info.url,
                            number: pr_merge.pr_info.number as i32,
                            status: pr_status,
                            merged_at: pr_merge.pr_info.merged_at,
                            merge_commit_sha: pr_merge.pr_info.merge_commit_sha,
                            target_branch_name: pr_merge.target_branch_name,
                            local_workspace_id: ws_id,
                        },
                    )
                    .await;
                }
            }
        });
    }

    Ok(ResponseJson(ApiResponse::success(())))
}

pub async fn unlink_workspace(
    AxumPath(workspace_id): AxumPath<uuid::Uuid>,
    State(deployment): State<DeploymentImpl>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let client = deployment.remote_client()?;

    match client.delete_workspace(workspace_id).await {
        Ok(()) => Ok(ResponseJson(ApiResponse::success(()))),
        Err(RemoteClientError::Http { status: 404, .. }) => {
            Ok(ResponseJson(ApiResponse::success(())))
        }
        Err(e) => Err(e.into()),
    }
}

pub fn router(deployment: &DeploymentImpl) -> ApiRouter<DeploymentImpl> {
    let post_router =
        ApiRouter::new()
            .api_route("/", post(link_workspace))
            .layer(from_fn_with_state(
                deployment.clone(),
                load_workspace_middleware,
            ));

    let delete_router = ApiRouter::new().api_route("/", delete(unlink_workspace));

    post_router.merge(delete_router)
}

pub fn router_for_spec() -> ApiRouter<DeploymentImpl> {
    ApiRouter::new()
        .api_route("/", post(link_workspace))
        .merge(ApiRouter::new().api_route("/", delete(unlink_workspace)))
}
