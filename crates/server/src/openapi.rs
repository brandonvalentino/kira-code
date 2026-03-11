use aide::{axum::ApiRouter, openapi::OpenApi};

pub fn build_api(api: &mut OpenApi) {
    let _ = ApiRouter::<crate::DeploymentImpl>::new()
        .nest("/api", crate::routes::api_router_for_spec())
        .finish_api(api);
}
