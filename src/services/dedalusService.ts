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

const SYSTEM_PROMPT = `You are a pitch analyst. Given a transcript of a live startup pitch, produce a structured analysis. Be concise.

Include:
- summary: 3-5 key points (id: s1..s5, text)
- signals: rate Market clarity, Technical depth, Differentiation, Confidence, Storytelling as High/Medium/Low/Unclear
- followUps: 2-4 investor follow-up questions (id: f1..f4, label)
- company: name, category, valueProposition (use "Not yet mentioned" if unknown)
- traction: arr, customerCount (use "Not yet mentioned" if unknown), growthSignals array
- riskFlags: 2-4 risks (id: r1..r4, text)
- analystNotes: 2-3 sentence synthesis`;

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

  async analyzePitch(transcript: string): Promise<PitchData> {
    const completion = await this.client.chat.completions.parse({
      model: 'openai/gpt-4.1-nano',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      response_format: zodResponseFormat(PitchDataSchema, 'pitch_analysis'),
      temperature: 0.2,
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error('Failed to parse structured pitch analysis response');
    }

    return parsed as PitchData;
  }
}
