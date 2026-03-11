pub mod codex_setup;
pub mod core;
pub mod create;
pub mod cursor_setup;
pub mod execution;
pub mod gh_cli_setup;
pub mod git;
pub mod images;
pub mod integration;
pub mod links;
pub mod pr;
pub mod repos;
pub mod streams;
pub mod workspace_summary;

use aide::axum::{
    ApiRouter,
    routing::{get, post, put},
};
use axum::middleware::from_fn_with_state;

use crate::{DeploymentImpl, middleware::load_workspace_middleware};

pub fn router(deployment: &DeploymentImpl) -> ApiRouter<DeploymentImpl> {
    let workspace_id_router = ApiRouter::new()
        .api_route(
            "/",
            get(core::get_workspace)
                .put(core::update_workspace)
                .delete(core::delete_workspace),
        )
        .api_route("/messages/first", get(core::get_first_user_message))
        .api_route("/seen", put(core::mark_seen))
        .nest("/git", git::router())
        .nest("/execution", execution::router())
        .nest("/integration", integration::router())
        .nest("/repos", repos::router())
        .nest("/pull-requests", pr::router())
        .layer(from_fn_with_state(
            deployment.clone(),
            load_workspace_middleware,
        ));

    let ws_streams: aide::axum::routing::ApiMethodRouter<DeploymentImpl> =
        axum::routing::get(streams::stream_workspaces_ws).into();
    let workspaces_router = ApiRouter::new()
        .api_route(
            "/",
            get(core::get_workspaces).post(create::create_workspace),
        )
        .api_route("/start", post(create::create_and_start_workspace))
        .api_route("/from-pr", post(pr::create_workspace_from_pr))
        .route("/streams/ws", ws_streams)
        .api_route(
            "/summaries",
            post(workspace_summary::get_workspace_summaries),
        )
        .nest("/{id}", workspace_id_router)
        .nest("/{id}/images", images::router(deployment))
        .nest("/{id}/links", links::router(deployment));

    ApiRouter::new()
        .nest("/workspaces", workspaces_router)
        .with_path_items(|p| p.tag("workspaces"))
}

pub fn router_for_spec() -> ApiRouter<DeploymentImpl> {
    let ws_streams: aide::axum::routing::ApiMethodRouter<DeploymentImpl> =
        axum::routing::get(streams::stream_workspaces_ws).into();

    let workspace_id_router = ApiRouter::new()
        .api_route(
            "/",
            get(core::get_workspace)
                .put(core::update_workspace)
                .delete(core::delete_workspace),
        )
        .api_route("/messages/first", get(core::get_first_user_message))
        .api_route("/seen", put(core::mark_seen))
        .nest("/git", git::router())
        .nest("/execution", execution::router())
        .nest("/integration", integration::router())
        .nest("/repos", repos::router())
        .nest("/pull-requests", pr::router());

    let workspaces_router = ApiRouter::new()
        .api_route(
            "/",
            get(core::get_workspaces).post(create::create_workspace),
        )
        .api_route("/start", post(create::create_and_start_workspace))
        .api_route("/from-pr", post(pr::create_workspace_from_pr))
        .route("/streams/ws", ws_streams)
        .api_route(
            "/summaries",
            post(workspace_summary::get_workspace_summaries),
        )
        .nest("/{id}", workspace_id_router)
        .nest("/{id}/images", images::router_for_spec())
        .nest("/{id}/links", links::router_for_spec());

    ApiRouter::new()
        .nest("/workspaces", workspaces_router)
        .with_path_items(|p| p.tag("workspaces"))
}
