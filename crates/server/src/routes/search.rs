use aide::axum::{ApiRouter, routing::get};
use axum::{
    extract::{Query, State},
    response::Json as ResponseJson,
};
use db::models::repo::{Repo, SearchResult};
use deployment::Deployment;
use schemars::JsonSchema;
use serde::Deserialize;
use services::services::file_search::{SearchMode, SearchQuery};
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

#[derive(Debug, Deserialize, JsonSchema)]
pub struct MultiRepoSearchQuery {
    pub q: String,
    #[serde(default)]
    pub mode: SearchMode,
    pub repo_ids: String,
}

pub async fn search_files(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<MultiRepoSearchQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<SearchResult>>>, ApiError> {
    let repo_ids: Vec<Uuid> = query
        .repo_ids
        .split(',')
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.trim().parse::<Uuid>())
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| ApiError::BadRequest("Invalid repo_id format".to_string()))?;

    if repo_ids.is_empty() {
        return Err(ApiError::BadRequest(
            "repo_ids parameter is required".to_string(),
        ));
    }

    if query.q.trim().is_empty() {
        return Ok(ResponseJson(ApiResponse::error(
            "Query parameter 'q' is required and cannot be empty",
        )));
    }

    let repos = Repo::find_by_ids(&deployment.db().pool, &repo_ids).await?;

    let search_query = SearchQuery {
        q: query.q,
        mode: query.mode,
    };

    let results = deployment
        .repo()
        .search_files(
            deployment.file_search_cache().as_ref(),
            &repos,
            &search_query,
        )
        .await
        .map_err(|e| {
            tracing::error!("Failed to search files: {}", e);
            ApiError::BadRequest(format!("Search failed: {}", e))
        })?;

    Ok(ResponseJson(ApiResponse::success(results)))
}

pub fn router(deployment: &DeploymentImpl) -> ApiRouter<DeploymentImpl> {
    ApiRouter::new()
        .api_route("/search", get(search_files))
        .with_state(deployment.clone())
}

pub fn router_for_spec() -> ApiRouter<DeploymentImpl> {
    ApiRouter::new().api_route("/search", get(search_files))
}
