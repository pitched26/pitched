import Dedalus, { toFile } from 'dedalus-labs';
import { zodResponseFormat } from 'dedalus-labs/helpers/zod';
import { z } from 'zod';
import type { PitchData } from '../types/pitch';

function ts(): string {
  return new Date().toISOString();
}

const PitchDataSchema = z.object({
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

// Pre-compute once at module load
const RESPONSE_FORMAT = zodResponseFormat(PitchDataSchema, 'pitch_coaching');

const SYSTEM_PROMPT = `You are a speaking coach. Given a transcript of a live pitch, produce structured coaching feedback. Be direct and actionable.

Include:
- tips: 1-3 imperative coaching tips, each under 12 words (id: t1..t3, text, category: delivery|content|structure|engagement, priority: high|medium|low). Focus on what the speaker should do RIGHT NOW.
- signals: rate Clarity, Energy, Structure, Persuasion, Pace as High/Medium/Low/Unclear
- coachNote: one sentence overall impression of the speaker's current performance`;

// Cap transcript sent to LLM to keep input tokens bounded
const MAX_TRANSCRIPT_CHARS = 1500;

function tailTranscript(transcript: string): string {
  if (transcript.length <= MAX_TRANSCRIPT_CHARS) return transcript;
  // Find a word boundary near the trim point
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
    const totalStart = performance.now();

    console.log(`[${ts()}] dedalus call #${callId} START — audioBuffer=${audioBuffer.length} bytes, priorTranscript=${priorTranscript.length} chars`);

    // Step 1: Transcribe
    const whisperStart = performance.now();
    const file = await toFile(audioBuffer, 'audio.webm');
    const transcription = await this.client.audio.transcriptions.create({
      file,
      model: 'openai/whisper-1',
      language: 'en',
    });
    const whisperMs = (performance.now() - whisperStart).toFixed(0);

    const newText = transcription.text;
    const fullTranscript = priorTranscript
      ? priorTranscript + ' ' + newText
      : newText;

    console.log(`[${ts()}] [DedalusService] call #${callId} WHISPER done in ${whisperMs}ms — newText="${newText.slice(0, 120)}${newText.length > 120 ? '…' : ''}" (${newText.length} chars), fullTranscript=${fullTranscript.length} chars`);

    // Step 2: Analyze with capped transcript window
    const llmInput = tailTranscript(fullTranscript);
    console.log(`[${ts()}] [DedalusService] call #${callId} LLM input (${llmInput.length} chars, capped from ${fullTranscript.length}): "${llmInput.slice(0, 200)}${llmInput.length > 200 ? '…' : ''}"`);

    const llmStart = performance.now();
    const completion = await this.client.chat.completions.parse({
      model: 'openai/gpt-4.1-nano',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: llmInput },
      ],
      response_format: RESPONSE_FORMAT,
      temperature: 0,
      max_tokens: 512,
    });
    const llmMs = (performance.now() - llmStart).toFixed(0);

    const usage = completion.usage;
    console.log(`[${ts()}] [DedalusService] call #${callId} LLM done in ${llmMs}ms — tokens: prompt=${usage?.prompt_tokens ?? '?'} completion=${usage?.completion_tokens ?? '?'} total=${usage?.total_tokens ?? '?'}`);

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      console.error(`[${ts()}] [DedalusService] call #${callId} PARSE FAILED — raw content: ${completion.choices[0]?.message?.content?.slice(0, 300)}`);
      throw new Error('Failed to parse pitch analysis response');
    }

    const data = parsed as PitchData;
    const totalMs = (performance.now() - totalStart).toFixed(0);
    console.log(`[${ts()}] [DedalusService] call #${callId} COMPLETE in ${totalMs}ms (whisper=${whisperMs}ms + llm=${llmMs}ms)`);
    console.log(`[${ts()}] [DedalusService] call #${callId} OUTPUT tips=[${data.tips.map(t => `"${t.text}"`).join(', ')}] signals=[${data.signals.map(s => `${s.label}:${s.value}`).join(', ')}] coachNote="${data.coachNote}"`);

    return { transcript: fullTranscript, data };
  }
}
