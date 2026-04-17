#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerAllTools } from "./tools/index.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "griply-mcp",
    version: "0.2.0",
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
    return;
  }

  const port = Number(process.env.PORT ?? 8001);
  const hostname = process.env.HOST ?? "0.0.0.0";

  Bun.serve({
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
      await server.connect(transport);
      const res = await transport.handleRequest(req);
      req.signal.addEventListener("abort", () => {
        void transport.close();
        void server.close();
      });
      return res;
    },
  });

  console.log(`griply-mcp listening on http://${hostname}:${port}/mcp`);
}

if (import.meta.main) {
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  await main();
}
