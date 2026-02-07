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
    text: z.string().describe('3-8 words. Observation or encouragement. Never start with You.'),
    category: z.enum(['delivery', 'content', 'structure', 'engagement']),
    priority: z.enum(['high', 'medium', 'low']),
  })).describe('1-2 micro-feedback tips. Short, calm, coach-like.'),
  signals: z.array(z.object({
    label: z.string(),
    value: z.enum(['High', 'Medium', 'Low', 'Unclear']),
  })),
  coachNote: z.string().describe('One calm sentence, 8 words max'),
});

const RESPONSE_FORMAT = zodResponseFormat(PitchAnalysisSchema, 'pitch_coaching');

const SYSTEM_PROMPT = `You are a calm, world-class pitch coach giving real-time micro-feedback. You hear the speaker's audio directly.

Your feedback philosophy: a subtle nudge on the shoulder, not a lecture.

Produce structured coaching output:

- transcript: word-for-word transcription of the audio clip
- tips: 1-2 micro-feedback observations. RULES:
  * 3-8 words each. One short sentence MAX.
  * NEVER start with "You said", "You mentioned", "Your pitch", "You should".
  * Reference content directly ("AI-first platform" not "You talked about your platform").
  * Format: observation, observation + qualifier, or encouragement. No explanations.
  * Bias toward encouragement. When the speaker is doing well, say so without hedging.
  * GOOD: "Hook is engaging", "Technical depth is landing", "Strong point — slow down", "Clear and compelling", "Rushing through key idea"
  * BAD (never output): "You said...", "Speak more clearly", "Be more confident", "You should consider..."
  (id: t1..t2, category: delivery|content|structure|engagement, priority: high|medium|low)
- signals: rate from audio — Confidence, Energy, Clarity, Pace, Persuasion as High/Medium/Low/Unclear
- coachNote: one calm sentence, 8 words max, about how the speaker sounds now`;

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
  /**
   * Generate a post-session summary using GPT-4.1 Nano.
   * 
   * 1. Pre-LLM: Validate, trim, aggregate inputs
   * 2. LLM Call: Dedalus API with retry
   * 3. Post-LLM: Validate response
   * 4. Fallback: Guaranteed local summary on failure
   */
  async generateSessionSummary(
    transcript: string,
    tips: { text: string; category: string }[],
    signals: { label: string; value: string }[],
    category: 'science' | 'tech' | 'business' = 'tech'
  ): Promise<string> {
    const callId = ++this.callCount;
    console.log(`[${ts()}] [Summary #${callId}] START — transcript=${transcript.length} chars, tips=${tips.length}, signals=${signals.length}, category=${category}`);

    // ═══════════════════════════════════════════════════════════════════
    // 1. PRE-LLM PROCESSING
    // ═══════════════════════════════════════════════════════════════════

    const cleanTranscript = transcript.trim();
    if (cleanTranscript.length < 50 && tips.length === 0) {
      console.log(`[${ts()}] [Summary #${callId}] SKIP LLM — insufficient data`);
      return this.generateLocalFallback(tips, signals, category);
    }

    const trimmedTranscript = cleanTranscript.slice(0, 3000);
    const signalsSummary = signals.length > 0
      ? signals.map(s => `${s.label}: ${s.value}`).join(', ')
      : 'No signal data';

    const sortedTips = [...tips].slice(0, 5);
    const tipsSummary = sortedTips.length > 0
      ? sortedTips.map(t => t.text).join('; ')
      : 'No specific feedback';

    const categoryContext = {
      science: 'scientific research pitch',
      tech: 'tech startup pitch',
      business: 'business presentation',
    }[category];

    // ═══════════════════════════════════════════════════════════════════
    // 2. LLM INVOCATION
    // ═══════════════════════════════════════════════════════════════════

    const systemPrompt = `You are a world-class pitch coach giving a brief post-session debrief.
Context: This was a ${categoryContext}.
Your response: 2-3 sentences max. Direct ("You..."). One strength, one improvement. No headers.`;

    const userPrompt = `Transcript excerpt:
"${trimmedTranscript.slice(0, 1500)}..."

Feedback: ${tipsSummary}
Signals: ${signalsSummary}

Give a concise debrief.`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const start = performance.now();

        const completion = await this.client.chat.completions.create({
          model: 'openai/gpt-4.1-nano',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 200,
        });

        const elapsed = (performance.now() - start).toFixed(0);
        const rawContent = completion.choices[0]?.message?.content;

        console.log(`[${ts()}] [Summary #${callId}] attempt ${attempt} done in ${elapsed}ms`);

        // ═══════════════════════════════════════════════════════════════
        // 3. POST-LLM VALIDATION
        // ═══════════════════════════════════════════════════════════════

        if (!rawContent || rawContent.trim().length < 20) {
          console.warn(`[${ts()}] [Summary #${callId}] Invalid response, retrying...`);
          continue;
        }

        let summary = rawContent.trim();
        summary = summary.replace(/^(Summary:|Feedback:|Debrief:|Here's|Okay,)\s*/i, '');
        summary = summary.replace(/^["']|["']$/g, '');
        if (summary.length > 500) summary = summary.slice(0, 500) + '...';

        console.log(`[${ts()}] [Summary #${callId}] SUCCESS`);
        return summary;

      } catch (err) {
        console.error(`[${ts()}] [Summary #${callId}] attempt ${attempt} FAILED — ${err instanceof Error ? err.message : err}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 500));
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // 4. FALLBACK
    // ═══════════════════════════════════════════════════════════════════

    console.log(`[${ts()}] [Summary #${callId}] Using local fallback`);
    return this.generateLocalFallback(tips, signals, category);
  }

  /** Generate a deterministic local fallback summary. */
  private generateLocalFallback(
    tips: { text: string; category: string }[],
    signals: { label: string; value: string }[],
    category: 'science' | 'tech' | 'business'
  ): string {
    const highSignals = signals.filter(s => s.value === 'High');
    const strength = highSignals.length > 0
      ? `Your ${highSignals[0].label.toLowerCase()} came through strongly`
      : 'You showed commitment to your message';

    const improvementTip = tips.length > 0
      ? tips[0].text
      : 'focusing on pausing between key points';

    const encouragement = {
      science: 'Keep refining how you communicate your methodology.',
      tech: 'Keep iterating on your pitch like you iterate on your product.',
      business: 'Keep sharpening your value proposition.',
    }[category];

    return `${strength}. For your next run, try ${improvementTip.toLowerCase().replace(/^you /, '')}. ${encouragement}`;
  }
}
