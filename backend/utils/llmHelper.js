let AnthropicPackage = require("@anthropic-ai/sdk");
const Anthropic = AnthropicPackage.default || AnthropicPackage;

const SYSTEM_PROMPT = `You are a nutrition habit review assistant. Analyze the customer's 7-day food habit diary.

Rules:
- Do not diagnose disease or prescribe medicines.
- Give practical food-habit feedback only.
- Mention that users with medical conditions should consult a qualified professional.
- Output in clean sections:
  1. Overall Pattern (മൊത്തത്തിലുള്ള രീതി)
  2. Positive Habits (നല്ല ശീലങ്ങൾ)
  3. Risk Areas (ശ്രദ്ധിക്കേണ്ട കാര്യങ്ങൾ)
  4. 7-Day Improvement Plan (7 ദിവസത്തെ മെച്ചപ്പെടുത്തൽ പദ്ധതി)
  5. Final Note (അവസാന കുറിപ്പ്)
- Write the entire response in Malayalam language.
- Keep it concise and customer-friendly.`;

exports.generateLLMAnalysis = async (summary) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is missing in backend .env");
    }

    if (!apiKey.startsWith("sk-ant-")) {
      throw new Error("Invalid Claude API key. Claude keys usually start with sk-ant-");
    }

    const anthropic = new Anthropic({
      apiKey
    });

    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 3000,
      temperature: 0.4,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: summary
        }
      ]
    });

    const text = response.content
      ?.filter((block) => block.type === "text")
      ?.map((block) => block.text)
      ?.join("\n");

    if (!text) {
      throw new Error("Claude returned empty response");
    }

    return text;
  } catch (err) {
    console.error("Claude analysis error:", {
      message: err.message,
      status: err.status,
      type: err.error?.type,
      error: err.error
    });

    throw new Error(err.message || "Claude analysis failed");
  }
};