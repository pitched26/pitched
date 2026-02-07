import Dedalus from 'dedalus-labs';
import { zodResponseFormat } from 'dedalus-labs/helpers/zod';
import { z } from 'zod';
import type { PitchData } from '../types/pitch';

function ts(): string {
  return new Date().toISOString();
}

// Schema includes transcript — the audio model transcribes + analyzes in one shot
const PitchAnalysisSchema = z.object({
  transcript: z.string().describe('Word-for-word transcription of the audio clip'),
  tips: z.array(z.object({
    id: z.string(),
    text: z.string(),
    category: z.enum(['delivery', 'content', 'structure', 'engagement']),
    priority: z.enum(['high', 'medium', 'low']),
  })),
  signals: z.array(z.object({
    label: z.string(),
    value: z.enum(['High', 'Medium', 'Low', 'Unclear']),
  })),
  coachNote: z.string(),
});

const RESPONSE_FORMAT = zodResponseFormat(PitchAnalysisSchema, 'pitch_coaching');

const SYSTEM_PROMPT = `You are an expert speaking coach analyzing a live pitch via audio. You can hear the speaker's voice directly — analyze BOTH what they say AND how they say it.

Listen for vocal sentiment and delivery cues:
- Confidence: steady voice vs. shaky, hedging language, upward inflections on statements
- Energy: vocal enthusiasm and conviction vs. flat/monotone delivery
- Pace: rushing through points, dragging, or well-paced with purposeful pauses
- Clarity: crisp articulation vs. mumbling, filler words (um, uh, like, you know)
- Emotion: genuine passion, nervousness, uncertainty, or rehearsed/robotic tone

Produce structured coaching feedback:

- transcript: word-for-word transcription of what was said in this audio clip
- tips: 1-3 hyper-specific tips based on what you ACTUALLY HEARD in the audio. Each tip MUST reference a specific moment, word, phrase, vocal pattern, or behavior from the audio. Under 15 words each.
  GOOD examples: "You said 'um' before every number — pause silently instead", "Your voice dropped to a mumble on pricing — project with conviction", "The pause after 'ten million' was powerful — use more like it"
  BAD examples (too generic, NEVER output these): "Speak more clearly", "Be more confident", "Slow down your pace"
  (id: t1..t3, text, category: delivery|content|structure|engagement, priority: high|medium|low)
- signals: rate from the audio — Confidence, Energy, Clarity, Pace, Persuasion as High/Medium/Low/Unclear
- coachNote: one vivid sentence about how the speaker sounds right now, citing something specific you heard`;

const MAX_TRANSCRIPT_CHARS = 1500;

function tailTranscript(transcript: string): string {
  if (transcript.length <= MAX_TRANSCRIPT_CHARS) return transcript;
  const start = transcript.indexOf(' ', transcript.length - MAX_TRANSCRIPT_CHARS);
  return start > 0 ? transcript.slice(start + 1) : transcript.slice(-MAX_TRANSCRIPT_CHARS);
}

export class DedalusService {
  private client: Dedalus;
  private callCount = 0;

  constructor(apiKey: string) {
    this.client = new Dedalus({ apiKey });
  }

  async analyzeAudio(
    audioBuffer: Buffer,
    priorTranscript: string
  ): Promise<{ transcript: string; data: PitchData }> {
    const callId = ++this.callCount;
    const start = performance.now();

    console.log(`[${ts()}] dedalus call #${callId} START — audioBuffer=${audioBuffer.length} bytes, priorTranscript=${priorTranscript.length} chars`);

    // Send raw audio directly to the model — no separate Whisper step
    const audioBase64 = audioBuffer.toString('base64');

    // Build multimodal user message: audio clip + optional prior context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userContent: any[] = [
      {
        type: 'input_audio',
        input_audio: { data: audioBase64, format: 'ldsgagsd' },
      },
    ];

    if (priorTranscript) {
      userContent.push({
        type: 'text',
        text: `Prior transcript (what the speaker said before this clip):\n"${tailTranscript(priorTranscript)}"`,
      });
    }

    const completion = await this.client.chat.completions.parse({
      model: 'openai/gpt-4o-audio-preview',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: RESPONSE_FORMAT,
      temperature: 0,
      max_tokens: 768,
    });

    const elapsed = (performance.now() - start).toFixed(0);
    const usage = completion.usage;
    console.log(`[${ts()}] [DedalusService] call #${callId} done in ${elapsed}ms — tokens: prompt=${usage?.prompt_tokens ?? '?'} completion=${usage?.completion_tokens ?? '?'} total=${usage?.total_tokens ?? '?'}`);

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      console.error(`[${ts()}] [DedalusService] call #${callId} PARSE FAILED — raw content: ${completion.choices[0]?.message?.content?.slice(0, 300)}`);
      throw new Error('Failed to parse pitch analysis response');
    }

    const result = parsed as z.infer<typeof PitchAnalysisSchema>;
    const fullTranscript = priorTranscript
      ? priorTranscript + ' ' + result.transcript
      : result.transcript;

    const data: PitchData = {
      tips: result.tips,
      signals: result.signals,
      coachNote: result.coachNote,
    };

    console.log(`[${ts()}] [DedalusService] call #${callId} COMPLETE in ${elapsed}ms — transcript="${result.transcript.slice(0, 80)}" tips=[${data.tips.map(t => `"${t.text}"`).join(', ')}] signals=[${data.signals.map(s => `${s.label}:${s.value}`).join(', ')}]`);

    return { transcript: fullTranscript, data };
  }
}
