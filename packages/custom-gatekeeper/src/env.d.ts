declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("./index.js");
    durableNamespaces: "CustomGatekeeper" | "BaProjectDurableObject" | "WorkflowRunDurableObject" | "BaProjectRegistryDurableObject";
  }
}
