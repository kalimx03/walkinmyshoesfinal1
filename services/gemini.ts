
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTIONS } from "../constants";

// Vite exposes env vars via import.meta.env
// vite.config.ts also injects process.env.API_KEY via define block as fallback
const GEMINI_API_KEY: string =
  (import.meta as any).env?.VITE_GEMINI_API_KEY ||
  (import.meta as any).env?.GEMINI_API_KEY ||
  (typeof process !== 'undefined' ? (process.env.API_KEY || process.env.GEMINI_API_KEY || '') : '') ||
  '';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// ── Model names (latest stable 2025) ─────────────────────────
// gemini-1.5-pro is deprecated — use gemini-2.0-flash (faster + supports vision)
const AUDIT_MODEL  = 'gemini-2.0-flash';
const CHAT_MODEL   = 'gemini-2.0-flash';

export const geminiService = {
  /**
   * High-precision ADA/WCAG architectural audit from image
   */
  async analyzeAccessibility(imageBase64: string): Promise<any> {
    try {
      const response = await ai.models.generateContent({
        model: AUDIT_MODEL,
        contents: {
          parts: [
            {
              text: `PERFORM ARCHITECTURAL ACCESSIBILITY AUDIT.
Analyze this image for ADA (Americans with Disabilities Act) and WCAG compliance.
Use spatial reasoning to estimate real-world dimensions from visual cues.

AUDIT TARGETS:
1. TACTILE PAVING — truncated domes, detectable warning surfaces
2. RAMPS — estimate slope (ADA max 1:12)
3. DOORWAYS — estimate clear opening width (ADA min 32")
4. OPERABLE PARTS — buttons/controls mounting height (15"–48")
5. PROTRUDING OBJECTS — wall protrusions >4" between 27"–80" high
6. SIGNAGE — font size, contrast, braille presence
7. LIGHTING — adequate illumination for low vision users
8. SEATING — accessible seating availability

For each item provide bounding box [ymin, xmin, ymax, xmax] on a 0–1000 scale.
RESPOND WITH JSON ONLY — no markdown fences, no preamble.`
            },
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }
          ]
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTIONS,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type:           { type: Type.STRING },
                    status:         { type: Type.STRING, enum: ['COMPLIANT','NON_COMPLIANT','WARNING'] },
                    description:    { type: Type.STRING },
                    recommendation: { type: Type.STRING },
                    costEstimate:   { type: Type.STRING },
                    coordinates:    { type: Type.ARRAY, items: { type: Type.NUMBER } }
                  },
                  required: ['type','status','description','recommendation','costEstimate','coordinates']
                }
              },
              overallComplianceScore: { type: Type.NUMBER }
            },
            required: ['issues','overallComplianceScore']
          }
        }
      });

      const raw = response.text || '';
      const clean = raw.trim().replace(/^```json\s*/i,'').replace(/```$/i,'').trim();

      // Handle empty response from Gemini
      if (!clean) {
        console.warn('Gemini returned empty response');
        return { issues: [], overallComplianceScore: 0 };
      }

      const parsed = JSON.parse(clean);

      if (parsed.issues) {
        parsed.issues = parsed.issues.filter(
          (i: any) => Array.isArray(i.coordinates) && i.coordinates.length === 4
        );
      }
      return parsed;
    } catch (err) {
      console.error('Gemini Audit Error:', err);
      return { issues: [], overallComplianceScore: 0 };
    }
  },

  /**
   * Architectural remediation description for visual fix panel
   */
  async editImage(imageBase64: string, prompt: string): Promise<string | null> {
    try {
      const response = await ai.models.generateContent({
        model: AUDIT_MODEL,
        contents: {
          parts: [
            { inlineData: { data: imageBase64, mimeType: 'image/jpeg' } },
            {
              text: `YOU ARE AN ARCHITECTURAL VISUALIZATION CONSULTANT.

Remediation Request: ${prompt}

Provide a DETAILED TECHNICAL SPECIFICATION for the ADA-compliant architectural fix:
1. Exact materials, dimensions (in inches/feet per ADA standards)
2. Step-by-step implementation plan
3. Specific location in the image to modify
4. Expected visual result after remediation
5. Cost breakdown with labor and materials

Be precise. Reference ADA section numbers where applicable.`
            }
          ]
        }
      });
      return response.text || null;
    } catch (err) {
      console.error('Image Edit Error:', err);
      return null;
    }
  },

  /**
   * Create a persistent chat session with scenario-aware context
   */
  createGuideChat(
    scenarioContext: string,
    initialHistory: { role: string; parts: { text: string }[] }[] = []
  ) {
    return ai.chats.create({
      model: CHAT_MODEL,
      history: initialHistory as any,
      config: {
        systemInstruction: `${SYSTEM_INSTRUCTIONS}

You are a specialist interactive guide for the "${scenarioContext}" simulation.
Keep answers concise (max 3 sentences), empathetic, and educational.
Always reference real ADA/WCAG standards when relevant.
Never break character — you are an embedded AI guide within an immersive simulation.`
      }
    });
  }
};
