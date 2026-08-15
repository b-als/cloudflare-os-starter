export * from "./custom.js";
export * from "./ba-schema.js";
export * from "./ba-session.js";
export * from "./workflow-demo.js";
export * from "./ba-project-store.js";

export default {
  async fetch(): Promise<Response> {
    return new Response("Custom Gatekeeper worker is running.", {
      headers: { "content-type": "text/plain" },
    });
  },
};
