# For MCP directories that check servers in a container (Glama). Nhipo itself is a Windows desktop app, so inside Linux the
# launcher serves its setup fallback (one tool, nhipo_setup, explaining how to install Nhipo). Real use: run on Windows with
# Nhipo installed (`npx -y nhipo-mcp`).
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY bin ./bin
ENTRYPOINT ["node", "bin/nhipo-mcp.js"]
