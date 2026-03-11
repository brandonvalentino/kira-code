use aide::axum::{ApiRouter, routing::get};
use api_types::{ListPullRequestsQuery, ListPullRequestsResponse};
use axum::{
    extract::{Query, State},
    response::Json as ResponseJson,
};
use utils::response::ApiResponse;

use crate::{DeploymentImpl, error::ApiError};

pub fn router() -> ApiRouter<DeploymentImpl> {
    ApiRouter::new().route("/pull-requests", get(list_pull_requests))
}

async fn list_pull_requests(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListPullRequestsQuery>,
) -> Result<ResponseJson<ApiResponse<ListPullRequestsResponse>>, ApiError> {
    let client = deployment.remote_client()?;
    let response = client.list_pull_requests(query.issue_id).await?;
    Ok(ResponseJson(ApiResponse::success(response)))
}
