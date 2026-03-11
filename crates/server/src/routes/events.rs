use aide::axum::{ApiRouter, routing::get};
use axum::{
    BoxError,
    extract::State,
    response::{
        Sse,
        sse::{Event, KeepAlive},
    },
    routing::get as axum_get,
};
use deployment::Deployment;
use futures_util::TryStreamExt;

use crate::DeploymentImpl;

pub async fn events(
    State(deployment): State<DeploymentImpl>,
) -> Result<Sse<impl futures_util::Stream<Item = Result<Event, BoxError>>>, axum::http::StatusCode>
{
    // Ask the container service for a combined "history + live" stream
    let stream = deployment.stream_events().await;
    Ok(Sse::new(stream.map_err(|e| -> BoxError { e.into() })).keep_alive(KeepAlive::default()))
}

pub fn router(_: &DeploymentImpl) -> ApiRouter<DeploymentImpl> {
    let events_router = ApiRouter::new().route("/", axum_get(events));

    ApiRouter::new().nest("/events", events_router)
}

pub fn router_for_spec() -> ApiRouter<DeploymentImpl> {
    let events_route: aide::axum::routing::ApiMethodRouter<DeploymentImpl> =
        axum::routing::get(events).into();
    ApiRouter::new().nest("/events", ApiRouter::new().route("/", events_route))
}
