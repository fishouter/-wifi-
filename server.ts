import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import "dotenv/config";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.post("/api/qwen", async (req, res) => {
    try {
      let qwenUrl = process.env.VITE_QWEN_URL;
      let qwenApiKey = process.env.VITE_QWEN_API_KEY;

      if (qwenUrl) qwenUrl = qwenUrl.replace(/^["']|["']$/g, '');
      if (qwenApiKey) qwenApiKey = qwenApiKey.replace(/^["']|["']$/g, '');

      console.log("Qwen API Request to:", qwenUrl);

      if (!qwenUrl || !qwenApiKey) {
        return res.status(500).json({ error: "Qwen API configuration missing" });
      }

      let isAnthropic = qwenUrl.includes('anthropic');
      
      // Auto-append path if it seems to be just a base URL
      if (isAnthropic && !qwenUrl.endsWith('/v1/messages')) {
        qwenUrl = qwenUrl.replace(/\/+$/, '') + '/v1/messages';
      } else if (!isAnthropic && !qwenUrl.endsWith('/v1/chat/completions') && !qwenUrl.includes('/generation')) {
        qwenUrl = qwenUrl.replace(/\/+$/, '') + '/v1/chat/completions';
      }

      const headers: any = {
        'Content-Type': 'application/json'
      };

      if (isAnthropic) {
        headers['x-api-key'] = qwenApiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${qwenApiKey}`;
      }

      const response = await fetch(qwenUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body)
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (!response.ok) {
          return res.status(response.status).json({ error: text || `Qwen API Error: ${response.status}` });
        }
        throw new Error(`Invalid JSON from Qwen API: ${text.substring(0, 100)}...`);
      }
      
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: error.message || "Proxy error" });
    }
  });

  app.post("/api/glm", async (req, res) => {
    try {
      let glmUrl = process.env.VITE_GLM_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      let glmApiKey = process.env.VITE_GLM_API_KEY;

      if (glmUrl) glmUrl = glmUrl.replace(/^["']|["']$/g, '');
      if (glmApiKey) glmApiKey = glmApiKey.replace(/^["']|["']$/g, '');

      console.log("GLM API Request to:", glmUrl);

      if (!glmApiKey) {
        return res.status(500).json({ error: "GLM API configuration missing" });
      }

      const headers: any = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${glmApiKey}`
      };

      const response = await fetch(glmUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(req.body)
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        if (!response.ok) {
          return res.status(response.status).json({ error: text || `GLM API Error: ${response.status}` });
        }
        throw new Error(`Invalid JSON from GLM API: ${text.substring(0, 100)}...`);
      }
      
      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Proxy error (GLM):", error);
      res.status(500).json({ error: error.message || "Proxy error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
