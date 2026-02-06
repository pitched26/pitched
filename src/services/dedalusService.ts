import Dedalus, { toFile } from 'dedalus-labs';
import { zodResponseFormat } from 'dedalus-labs/helpers/zod';
import { z } from 'zod';
import type { PitchData } from '../types/pitch';

const PitchDataSchema = z.object({
  summary: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    })
  ),
  signals: z.array(
    z.object({
      label: z.string(),
      value: z.enum(['High', 'Medium', 'Low', 'Unclear']),
    })
  ),
  followUps: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
    })
  ),
  company: z.object({
    name: z.string(),
    category: z.string(),
    valueProposition: z.string(),
  }),
  traction: z.object({
    arr: z.string(),
    customerCount: z.string(),
    growthSignals: z.array(z.string()),
  }),
  riskFlags: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
    })
  ),
  analystNotes: z.string(),
});

const SYSTEM_PROMPT = `You are an expert pitch analyst evaluating a live startup pitch in real-time. Analyze the provided transcript (and optionally a video frame of the presenter) to produce a structured pitch analysis.

Your analysis must include:
1. **Summary**: 3-5 key points about what the founder is saying/pitching. Each with a unique id (s1, s2, etc.) and concise text.
2. **Signals**: Evaluate these dimensions with a level of High, Medium, Low, or Unclear:
   - Market clarity: How well is the target market defined?
   - Technical depth: How technically credible is the pitch?
   - Differentiation: How clearly is the product differentiated?
   - Confidence: How confident does the presenter appear?
   - Storytelling: How compelling is the narrative?
3. **Follow-ups**: 2-4 suggested follow-up questions an investor should ask. Each with a unique id (f1, f2, etc.) and a short label.
4. **Company**: Extract the company name, category, and value proposition. If not yet mentioned, use "Not yet mentioned" as the value.
5. **Traction**: Extract ARR, customer count, and growth signals. If not mentioned, use "Not yet mentioned" for arr/customerCount and an empty array for growthSignals.
6. **Risk Flags**: 2-4 identified risks. Each with a unique id (r1, r2, etc.) and text.
7. **Analyst Notes**: A 2-3 sentence synthesis of the pitch quality, strengths, and gaps.

Be concise and direct. Focus on what has actually been said in the transcript.`;

export class DedalusService {
  private client: Dedalus;

  constructor(apiKey: string) {
    this.client = new Dedalus({ apiKey });
  }

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const file = await toFile(audioBuffer, 'audio.webm');
    const response = await this.client.audio.transcriptions.create({
      file,
      model: 'openai/whisper-1',
      language: 'en',
    });
    return response.text;
  }

  async analyzePitch(
    transcript: string,
    frameBase64?: string
  ): Promise<PitchData> {
    const userContent: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string; detail: 'low' } }
    > = [
      {
        type: 'text' as const,
        text: `Here is the running transcript of the pitch so far:\n\n${transcript}`,
      },
    ];

    if (frameBase64) {
      userContent.push({
        type: 'image_url' as const,
        image_url: {
          url: `data:image/jpeg;base64,${frameBase64}`,
          detail: 'low' as const,
        },
      });
    }

    const completion = await this.client.chat.completions.parse({
      model: 'openai/gpt-5.2',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: zodResponseFormat(PitchDataSchema, 'pitch_analysis'),
      temperature: 0.3,
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error('Failed to parse structured pitch analysis response');
    }

    return parsed as PitchData;
  }
}
