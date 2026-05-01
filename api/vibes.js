// api/vibes.js — Vercel serverless function
// Calls Gemini to generate a fresh fitness quote + joke
// Called by the app, result cached in Firebase via the client

export default async function handler(req, res) {
  // CORS — allow requests from your Vercel app
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "GEMINI_API_KEY not configured" });
    return;
  }

  const { type = "both" } = req.query; // "quote", "joke", or "both"

  const prompt = buildPrompt(type);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 300,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini error:", err);
      res.status(500).json({ error: "Gemini API error", detail: err });
      return;
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!raw) {
      res.status(500).json({ error: "Empty response from Gemini" });
      return;
    }

    // Parse JSON from Gemini response
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    res.status(200).json({
      ...parsed,
      generatedAt: new Date().toISOString(),
      model: "gemini-1.5-flash",
    });
  } catch (err) {
    console.error("Handler error:", err);
    res.status(500).json({ error: err.message });
  }
}

function buildPrompt(type) {
  const quotePrompt = `Generate ONE short motivational quote about fitness, discipline, or health.
- Max 20 words
- Can be original or attributed to a real person
- Punchy, memorable, not cheesy
- Return: { "quote": "...", "author": "..." } (author can be empty string if original)`;

  const jokePrompt = `Generate ONE funny 1-2 liner joke or observation. Rules:
- About fitness, gym, diet, health, or general life struggle
- Tone: dark-ish, absurd, self-deprecating, or just gloriously stupid
- Relatable for a group of friends in their 30s, slightly out of shape, trying to be healthy
- Avoid very American or British references — keep it universal or vaguely South Asian flavour
- No punchline format needed — can be an observation, complaint, or random thought
- Max 40 words
- Return: { "joke": "..." }`;

  const bothPrompt = `You are generating content for a fitness accountability app used by a squad of friends in their 30s.
They fine each other for missing gym, eating junk, skipping sleep, etc.

Generate BOTH of the following:

1. ONE motivational quote (max 20 words, punchy, can be attributed or original)
2. ONE funny joke/observation (max 40 words, dark-ish or absurd humour, relatable for slightly-out-of-shape 30-somethings trying to be healthy, vaguely South Asian context works well, no forced punchlines)

Return ONLY valid JSON in this exact format, nothing else:
{
  "quote": "...",
  "author": "...",
  "joke": "..."
}`;

  if (type === "quote") return quotePrompt + "\nReturn ONLY valid JSON, nothing else.";
  if (type === "joke") return jokePrompt + "\nReturn ONLY valid JSON, nothing else.";
  return bothPrompt;
}
