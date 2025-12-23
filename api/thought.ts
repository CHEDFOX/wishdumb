import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, systemPrompt } = req.body;

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://vercel.app",
          "X-Title": "Aether",
        },
        body: JSON.stringify({
          model: process.env.OPENROUTER_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
          temperature: 0.65,
          max_tokens: 160,
        }),
      }
    );

    const data = await response.json();

    res.status(200).json({
      text: data.choices?.[0]?.message?.content ?? "",
    });
  } catch (err) {
    res.status(500).json({ error: "LLM failure" });
  }
}
