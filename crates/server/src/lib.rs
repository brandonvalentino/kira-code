pub mod error;
pub mod middleware;
pub mod openapi;
pub mod preview_proxy;
pub mod routes;
pub mod tunnel;

// #[cfg(feature = "cloud")]
// type DeploymentImpl = kira_code_cloud::deployment::CloudDeployment;
// #[cfg(not(feature = "cloud"))]
pub type DeploymentImpl = local_deployment::LocalDeployment;
