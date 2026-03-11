use aide::{axum::ApiRouter, openapi::OpenApi};

pub fn build_api(api: &mut OpenApi) {
    let mut router = crate::routes::api_router_for_spec();
    router.finish_api(api);
}
