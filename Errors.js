// Turn raw AI/API errors into short messages a student can act on.
export function friendlyError(error) {
  if (error && error.userMessage) return { status: 502, message: error.userMessage };

  const msg = String((error && error.message) || error || "");
  const status = Number(error && (error.status || error.code)) || 0;

  if (status === 429 || /\b429\b|RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg)) {
    return { status: 429, message: "The free AI quota is used up for the moment. Wait a minute and try again." };
  }
  if (status === 404 || /NOT_FOUND|no longer available|model.*not found/i.test(msg)) {
    return { status: 502, message: "The AI model is not available. Open AI Studio, pick a model from its list, and set GEMINI_MODEL in your .env file." };
  }
  if (status === 401 || status === 403 || /API key|API_KEY_INVALID|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)) {
    return { status: 502, message: "The AI service rejected the API key. Check GEMINI_API_KEY in your .env file." };
  }
  if (error instanceof SyntaxError) {
    return { status: 502, message: "The AI returned something I could not read. Please try again." };
  }
  return { status: 500, message: "Something went wrong while contacting the AI. Please try again." };
}