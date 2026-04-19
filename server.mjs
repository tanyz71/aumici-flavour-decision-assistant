import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const host = "127.0.0.1";
const port = 8080;
const root = path.resolve("C:/Users/jeffr/Documents/Codex/2026-04-17-ai-gelato-designer");
const workbookPath = "C:/Users/jeffr/Downloads/gelato_decision_matrix.xlsx";
const bundledPython = "C:/Users/jeffr/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
const openAiApiKey = process.env.OPENAI_API_KEY || "";
const googleSheetId = "1Ao1cB5x5-d-PZZYORg7MsFDclcu8cQ0dXL18BGhJ8-c";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function safePath(requestUrl) {
  const parsed = new url.URL(requestUrl, `http://${host}:${port}`);
  const pathname = decodeURIComponent(parsed.pathname === "/" ? "/index.html" : parsed.pathname);
  const resolved = path.normalize(path.join(root, pathname));
  if (!resolved.startsWith(root)) {
    return null;
  }
  return resolved;
}

function readWorkbook() {
  const script = `
import json
from openpyxl import load_workbook

workbook_path = r"${workbookPath.replace(/\\/g, "\\\\")}"
wb = load_workbook(workbook_path, data_only=True)
payload = {"filePath": workbook_path, "sheets": []}

for ws in wb.worksheets:
    rows = []
    for row in ws.iter_rows(values_only=True):
        normalized = []
        for cell in row:
            if cell is None:
                normalized.append("")
            else:
                normalized.append(str(cell))
        if any(value != "" for value in normalized):
            rows.append(normalized)
    payload["sheets"].append({
        "name": ws.title,
        "rowCount": len(rows),
        "columnCount": max((len(row) for row in rows), default=0),
        "rows": rows,
    })

print(json.dumps(payload))
`;

  return new Promise((resolve, reject) => {
    const child = spawn(bundledPython, ["-c", script], { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Workbook reader exited with code ${code}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compactItems(items = [], limit = 40) {
  return items.slice(0, limit).map((item) => ({
    name: item.name || "",
    type: item.type || "",
    price: item.price || "",
    description: item.description || "",
    status: item.status || "",
    toppings: item.toppings || "",
    tags: Array.isArray(item.tags) ? item.tags.slice(0, 10) : []
  }));
}

async function generateOpenAiRecommendations(payload) {
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const occasion = payload.occasion || "";
  const mood = payload.mood || "";
  const flavours = compactItems(payload.flavours || []);
  const toppings = compactItems(payload.toppings || []);

  const instructions = [
    "You are helping a gelato customer choose dessert.",
    "Use only the available flavours and toppings provided.",
    "Return exactly five recommendations.",
    "Do not invent unavailable flavours or toppings.",
    "Prefer options that best match the customer's occasion and feeling.",
    "You may recommend a mixed option that combines one gelato and one sorbet when it fits well.",
    "Do not rely on a fixed decision matrix.",
    "Infer the best fit directly from the customer answers and the available menu metadata.",
    'Respond as JSON only with this shape: {"recommendations":[{"flavour":"string","toppings":["string"],"reason":"string","confidence":0.0}]}.' 
  ].join(" ");

  const input = [
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: JSON.stringify({
            task: "Recommend five flavour and topping combinations for a dessert ordering wizard using only current availability and return the answer as JSON.",
            customer: { occasion, mood },
            availableFlavours: flavours,
            availableToppings: toppings
          })
        }
      ]
    }
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input,
      instructions,
      reasoning: { effort: "minimal" },
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_object"
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `OpenAI request failed with ${response.status}`);
  }

  const data = await response.json();
  const outputText = extractOutputText(data);
  const parsed = JSON.parse(outputText);

  if (!Array.isArray(parsed.recommendations)) {
    throw new Error("OpenAI returned JSON without a recommendations array");
  }

  return parsed;
}

function extractOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const message = (data.output || []).find((item) => item.type === "message");
  const textItem = message?.content?.find((item) => item.type === "output_text");
  if (typeof textItem?.text === "string" && textItem.text.trim()) {
    return textItem.text;
  }

  throw new Error("OpenAI response did not include output text");
}

async function fetchGoogleSheetTable(sheetName) {
  const target = `https://docs.google.com/spreadsheets/d/${googleSheetId}/gviz/tq?sheet=${encodeURIComponent(sheetName)}&tqx=out:json`;
  const response = await fetch(target, {
    headers: {
      "User-Agent": "Mozilla/5.0 Codex Local Server"
    }
  });

  if (!response.ok) {
    throw new Error(`Google sheet request failed with ${response.status}`);
  }

  const text = await response.text();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("Unexpected Google sheet response format");
  }

  return JSON.parse(text.slice(start, end + 1));
}

const server = http.createServer(async (req, res) => {
  const parsed = new url.URL(req.url || "/", `http://${host}:${port}`);
  if (parsed.pathname === "/api/openai-status") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ configured: Boolean(openAiApiKey) }));
    return;
  }

  if (parsed.pathname === "/api/decision-matrix") {
    try {
      const payload = await readWorkbook();
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Unable to read workbook", detail: String(error.message || error) }));
    }
    return;
  }

  if (parsed.pathname === "/api/recommendations-dev" && req.method === "POST") {
    try {
      const payload = await readJsonBody(req);
      const recommendations = await generateOpenAiRecommendations(payload);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(recommendations));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "Unable to generate OpenAI recommendations",
          detail: String(error.message || error)
        })
      );
    }
    return;
  }

  if (parsed.pathname === "/api/google-sheet") {
    const sheet = parsed.searchParams.get("sheet") || "";
    if (!sheet) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Missing sheet parameter" }));
      return;
    }

    try {
      const payload = await fetchGoogleSheetTable(sheet);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(payload));
    } catch (error) {
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: "Unable to fetch Google sheet",
          detail: String(error.message || error),
          sheet
        })
      );
    }
    return;
  }

  const filePath = safePath(req.url || "/");
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, {
        "Content-Type": "text/plain; charset=utf-8"
      });
      res.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0"
    });
    res.end(data);
  });
});

server.listen(port, host, () => {
  console.log(`Velvet Cone Lab is running at http://${host}:${port}`);
});
