use aide::axum::ApiRouter;
use axum::{
    Router,
    routing::{IntoMakeService, get},
};
use tower_http::validate_request::ValidateRequestHeaderLayer;

use crate::{DeploymentImpl, middleware};

pub mod approvals;
pub mod config;
pub mod containers;
pub mod filesystem;
// pub mod github;
pub mod events;
pub mod execution_processes;
pub mod frontend;
pub mod health;
pub mod images;
pub mod migration;
pub mod oauth;
pub mod organizations;
pub mod relay_auth;
pub mod relay_ws;
pub mod releases;
pub mod remote;
pub mod repo;
pub mod scratch;
pub mod search;
pub mod sessions;
pub mod tags;
pub mod terminal;
pub mod workspaces;

pub fn router(deployment: DeploymentImpl) -> IntoMakeService<Router> {
    // Build OpenAPI spec once at startup
    let mut api = aide::openapi::OpenApi::default();
    crate::openapi::build_api(&mut api);

    let relay_signed_routes = Router::new()
        .merge(Into::<axum::Router<DeploymentImpl>>::into(health::router()))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(config::router()))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            containers::router(&deployment),
        ))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            workspaces::router(&deployment),
        ))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            execution_processes::router(&deployment),
        ))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(tags::router(
            &deployment,
        )))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(oauth::router()))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            organizations::router(),
        ))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            filesystem::router(),
        ))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(repo::router()))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(events::router(
            &deployment,
        )))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            approvals::router(),
        ))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(scratch::router(
            &deployment,
        )))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(search::router(
            &deployment,
        )))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            releases::router(),
        ))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            migration::router(),
        ))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            sessions::router(&deployment),
        ))
        .merge(Into::<axum::Router<DeploymentImpl>>::into(
            terminal::router(),
        ))
        .nest(
            "/remote",
            Into::<axum::Router<DeploymentImpl>>::into(remote::router()),
        )
        .nest(
            "/images",
            Into::<axum::Router<DeploymentImpl>>::into(images::routes()),
        )
        .layer(axum::middleware::from_fn_with_state(
            deployment.clone(),
            middleware::sign_relay_response,
        ))
        .layer(axum::middleware::from_fn_with_state(
            deployment.clone(),
            middleware::require_relay_request_signature,
        ))
        .with_state(deployment.clone());

    let api_routes = Router::new()
        .merge(relay_auth::router_for_spec())
        .merge(relay_signed_routes)
        // Serve OpenAPI spec JSON
        .route(
            "/openapi.json",
            get(
                |axum::Extension(api): axum::Extension<aide::openapi::OpenApi>| async move {
                    axum::Json(api)
                },
            ),
        )
        // Serve Swagger UI at /api/docs
        .route("/docs", {
            let r: axum::routing::MethodRouter<DeploymentImpl> =
                aide::swagger::Swagger::new("/api/openapi.json")
                    .with_title("Kira Code API")
                    .axum_route()
                    .into();
            r
        })
        .layer(axum::Extension(api))
        .layer(ValidateRequestHeaderLayer::custom(
            middleware::validate_origin,
        ))
        .with_state(deployment);

    Router::new()
        .route("/", get(frontend::serve_frontend_root))
        .route("/{*path}", get(frontend::serve_frontend))
        .nest("/api", api_routes)
        .into_make_service()
}

/// Builds a full ApiRouter for OpenAPI spec generation.
/// Uses router_for_spec() variants (no middleware) for routers that require DeploymentImpl.
/// aide only reads the route tree structure — middleware is not needed for spec generation.
pub fn api_router_for_spec() -> ApiRouter<DeploymentImpl> {
    ApiRouter::new()
        .merge(health::router_for_spec())
        .merge(config::router_for_spec())
        .merge(containers::router_for_spec())
        .merge(workspaces::router_for_spec())
        .merge(execution_processes::router_for_spec())
        .merge(tags::router_for_spec())
        .merge(oauth::router_for_spec())
        .merge(organizations::router_for_spec())
        .merge(filesystem::router_for_spec())
        .merge(repo::router_for_spec())
        .merge(events::router_for_spec())
        .merge(approvals::router_for_spec())
        .merge(scratch::router_for_spec())
        .merge(search::router_for_spec())
        .merge(releases::router_for_spec())
        .merge(migration::router_for_spec())
        .merge(sessions::router_for_spec())
        .merge(terminal::router_for_spec())
        .merge(relay_auth::router_for_spec())
        .nest("/remote", remote::router())
        .nest("/images", images::routes())
}
