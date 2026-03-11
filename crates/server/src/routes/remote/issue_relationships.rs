use aide::axum::{ApiRouter, routing::get};
use api_types::{
    CreateIssueRelationshipRequest, IssueRelationship, ListIssueRelationshipsQuery,
    ListIssueRelationshipsResponse, MutationResponse,
};
use axum::{
    extract::{Json, Path, Query, State},
    response::Json as ResponseJson,
};
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

pub fn router() -> ApiRouter<DeploymentImpl> {
    ApiRouter::new()
        .route(
            "/issue-relationships",
            get(list_issue_relationships).post(create_issue_relationship),
        )
        .route(
            "/issue-relationships/{relationship_id}",
            aide::axum::routing::delete(delete_issue_relationship),
        )
}

async fn list_issue_relationships(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<ListIssueRelationshipsQuery>,
) -> Result<ResponseJson<ApiResponse<ListIssueRelationshipsResponse>>, ApiError> {
    let client = deployment.remote_client()?;
    let response = client.list_issue_relationships(query.issue_id).await?;
    Ok(ResponseJson(ApiResponse::success(response)))
}

async fn create_issue_relationship(
    State(deployment): State<DeploymentImpl>,
    Json(request): Json<CreateIssueRelationshipRequest>,
) -> Result<ResponseJson<ApiResponse<MutationResponse<IssueRelationship>>>, ApiError> {
    let client = deployment.remote_client()?;
    let response = client.create_issue_relationship(&request).await?;
    Ok(ResponseJson(ApiResponse::success(response)))
}

async fn delete_issue_relationship(
    State(deployment): State<DeploymentImpl>,
    Path(relationship_id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<()>>, ApiError> {
    let client = deployment.remote_client()?;
    client.delete_issue_relationship(relationship_id).await?;
    Ok(ResponseJson(ApiResponse::success(())))
}
