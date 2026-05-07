#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerAllTools } from "./tools/index.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "griply-mcp",
    version: "0.2.0", // x-release-please-version
  });
  registerAllTools(server);
  return server;
}

async function main() {
  const useStdio = process.argv.includes("--stdio");

  if (useStdio) {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.on("SIGINT", () => process.exit(0));
    process.on("SIGTERM", () => process.exit(0));
    return;
  }

  const port = Number(process.env.PORT ?? 8001);
  const hostname = process.env.HOST ?? "0.0.0.0";

  const httpServer = Bun.serve({
    port,
    hostname,
    idleTimeout: 255,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/health") return new Response("ok");
      if (url.pathname !== "/mcp") {
        return new Response("not found", { status: 404 });
      }
      console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname} ua=${req.headers.get("user-agent") ?? "-"}`);

      const server = createServer();
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      req.signal.addEventListener("abort", () => {
        void transport.close();
        void server.close();
      });

      try {
        await server.connect(transport);
        return await transport.handleRequest(req);
      } catch (err) {
        console.error(`[${new Date().toISOString()}] mcp handler error:`, err);
        void transport.close();
        void server.close();
        return new Response("internal error", { status: 500 });
      }
    },
  });

  console.log(`griply-mcp listening on http://${hostname}:${port}/mcp`);

  // Drain in-flight requests before exit. closeActiveConnections=false is the default;
  // pass it explicitly for clarity.
  const shutdown = async () => {
    await httpServer.stop(false);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (import.meta.main) {
  await main();
}
