import Groq from "groq-sdk";

const getGroqClient = () => (process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null);

// Wraps a Groq call so any failure (missing key, network issue, bad response,
// unparsable JSON) is caught here and NEVER allowed to break the booking/visit flow.
// The caller always gets back a usable object with a `failed` flag.
const safeGroqCall = async (systemPrompt, userPrompt, fallback) => {
  const groq = getGroqClient();
  const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  if (!groq) {
    console.warn("GROQ_API_KEY not set - returning fallback summary.");
    return { ...fallback, failed: true };
  }

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const choice = completion.choices[0];
    const raw = choice?.message?.content;
    try {
      const parsed = JSON.parse(raw);
      return { ...parsed, failed: false };
    } catch (parseErr) {
      console.error(
        `Groq reply was not valid JSON | model=${MODEL} finish_reason=${choice?.finish_reason} ` +
          `length=${raw?.length ?? 0} parseError=${parseErr.message}`
      );
      return { ...fallback, failed: true };
    }
  } catch (err) {
    // API-level failure: bad key, rate limit, network, unknown model...
    console.error(`Groq API call failed | model=${MODEL} status=${err.status ?? "n/a"} message=${err.message}`);
    return { ...fallback, failed: true };
  }
};

export const generatePreVisitSummary = async (symptoms) => {
  const systemPrompt = `You are a clinical triage assistant. Analyse the patient's described symptoms and
respond ONLY with a JSON object in this exact shape:
{
  "urgency": "Low" | "Medium" | "High",
  "chiefComplaint": "one short sentence summarising the main complaint",
  "suggestedQuestions": ["question 1", "question 2", "question 3"]
}
Provide exactly three suggested questions the doctor could ask the patient. Do not include any text outside the JSON object.`;

  const userPrompt = `Symptoms: ${symptoms}`;

  const fallback = {
    urgency: "Medium",
    chiefComplaint: "Automatic summary unavailable - please review symptoms below manually.",
    suggestedQuestions: [
      "Can you describe when the symptoms started?",
      "Have you noticed anything that makes it better or worse?",
      "Are you currently taking any medication?",
    ],
  };

  return safeGroqCall(systemPrompt, userPrompt, fallback);
};

export const generatePostVisitSummary = async (notes, prescription) => {
  const systemPrompt = `You are a medical communication assistant. Convert clinical notes and a prescription
into a warm, clear, patient-friendly summary. Avoid unexplained medical jargon.
Respond ONLY with a JSON object in this exact shape:
{
  "summary": "a friendly paragraph explaining the diagnosis/notes in plain language",
  "medicationSchedule": "a plain-language description of when/how to take each medicine",
  "followUpSteps": "plain-language next steps or when to come back"
}
Do not include any text outside the JSON object.`;

  const prescriptionText = (prescription || [])
    .map((p) => `${p.medicineName} - ${p.dosage}, ${p.frequencyPerDay}x/day for ${p.durationDays} days. ${p.instructions || ""}`)
    .join("\n");

  const userPrompt = `Clinical notes: ${notes}\n\nPrescription:\n${prescriptionText || "None"}`;

  const fallback = {
    summary: "Your doctor has recorded notes for this visit. Please contact the clinic if you'd like this explained further.",
    medicationSchedule: prescriptionText || "No medication prescribed.",
    followUpSteps: "Please follow up with the clinic if symptoms persist or worsen.",
  };

  const result = await safeGroqCall(systemPrompt, userPrompt, fallback);
  // Flatten into a single displayable text block for storage, but keep pieces available
  const text = result.failed
    ? `${result.summary}\n\nMedication: ${result.medicationSchedule}\n\nFollow-up: ${result.followUpSteps}`
    : `${result.summary}\n\nMedication schedule: ${result.medicationSchedule}\n\nFollow-up: ${result.followUpSteps}`;

  return { text, failed: result.failed };
};