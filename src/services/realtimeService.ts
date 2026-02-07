import WebSocket from 'ws';
import type { PitchData } from '../types/pitch';

function ts(): string {
  return new Date().toISOString();
}

const TAG = '[Realtime]';

const MODE_CONTEXT: Record<string, string> = {
  science: `MODE: Science Pitch
Focus on: data accuracy, methodology rigor, clarity of hypothesis, statistical claims, reproducibility.
Judging criteria: prioritize scientific precision, clear methodology explanation, evidence quality, and logical structure. Be strict on unsupported claims and vague methodology.`,
  tech: `MODE: Tech Pitch
Focus on: innovation, technical architecture, scalability, developer experience, competitive differentiation.
Judging criteria: prioritize technical depth, feasibility, clear value proposition, and demo readiness. Be strict on hand-waving and unsubstantiated scalability claims.`,
  business: `MODE: Business Pitch
Focus on: market fit, revenue model, traction metrics, competitive landscape, growth strategy, unit economics.
Judging criteria: prioritize clear business model, realistic projections, market understanding, and compelling narrative. Be strict on missing numbers and vague go-to-market.`,
};

function buildInstructions(mode: string, customInstructions: string): string {
  const modeSection = MODE_CONTEXT[mode] || MODE_CONTEXT.tech;

  let prompt = `You are a calm, world-class pitch coach giving real-time micro-feedback via a floating UI bar. You hear the speaker's audio directly.

Your feedback philosophy: a subtle nudge on the shoulder, not a lecture.

${modeSection}

RULES — follow these exactly:
1. Each tip is 5-10 words. One short sentence MAX. No conjunctions.
2. NEVER start with "You said", "You mentioned", "Your pitch", "The user", "You should consider".
3. When referencing content, state the idea directly (e.g. "AI-first platform" not "You said your platform uses AI").
4. Format: observation only, observation + short qualifier, or feedback only. No explanations. No "because".
5. Tone: calm, objective, supportive. Never sarcastic or harsh.
6. When the speaker is doing well, say so clearly. Do not hedge or soften praise.
7. NEVER repeat feedback you gave in the last 3 cycles.

FEEDBACK VOCABULARY — model these:
Hook: "Hook is engaging" / "Hook needs more tension" / "Opening grabs attention" / "Hook feels rushed"
Content: "Technical depth is landing" / "Explanation lacks precision" / "Methodology feels accessible"
Impact: "Impact is clear" / "Takeaway lacks scale" / "Ending lands well" / "Zoom-out is compelling"
Delivery: "Strong point — slow down" / "Good flow" / "Rushing through key idea" / "Nice pacing here"
Positive: "This lands well" / "Clear and compelling" / "Strong explanation" / "Good balance of depth"

HARD ANTI-PATTERNS (never output):
- Multi-clause sentences
- "Speak more clearly", "Be more confident", "Slow down your pace" (too generic)
- Over-explaining or moralizing
- Phrases starting with "You should", "Try to", "Consider"
- Constant negativity — bias toward encouragement unless correction is clearly needed`;

  if (customInstructions.trim()) {
    prompt += `\n\nCUSTOM INSTRUCTIONS FROM USER:\n${customInstructions.trim()}`;
  }

  return prompt;
}

const COACHING_TOOL = {
  type: 'function' as const,
  name: 'provide_coaching',
  description: 'Provide real-time micro-feedback. Tips must be 3-8 words each. Bias toward encouragement.',
  parameters: {
    type: 'object',
    required: ['tips', 'signals', 'coachNote'],
    properties: {
      tips: {
        type: 'array',
        description: '1-2 micro-feedback tips. 3-8 words each. No "You said" or "You should". State observations directly.',
        items: {
          type: 'object',
          required: ['id', 'text', 'category', 'priority'],
          properties: {
            id: { type: 'string' },
            text: { type: 'string', description: '3-8 words. Observation or encouragement. Never start with You.' },
            category: { type: 'string', enum: ['delivery', 'content', 'structure', 'engagement'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
        },
      },
      signals: {
        type: 'array',
        description: 'Rate Confidence, Energy, Clarity, Pace, Persuasion from the audio',
        items: {
          type: 'object',
          required: ['label', 'value'],
          properties: {
            label: { type: 'string' },
            value: { type: 'string', enum: ['High', 'Medium', 'Low', 'Unclear'] },
          },
        },
      },
      coachNote: {
        type: 'string',
        description: 'One calm sentence, 8 words max, about how the speaker sounds right now',
      },
    },
  },
};

// Pending analysis request waiting for the model's response
interface PendingRequest {
  resolve: (value: { transcript: string; data: PitchData }) => void;
  reject: (reason: Error) => void;
  startTime: number;
}

export class RealtimeService {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private connectPromise: Promise<void> | null = null;
  private callCount = 0;

  // Accumulated transcript from input_audio_transcription events
  private transcript = '';
  private pendingTranscript = '';

  // Current pending analysis
  private pending: PendingRequest | null = null;

  // Function call accumulation
  private currentCallId = '';
  private currentArgs = '';

  // Settings
  private mode = 'tech';
  private customInstructions = '';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /** Connect to the Realtime API (idempotent) */
  async ensureConnected(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.connect();
    return this.connectPromise;
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[${ts()}] ${TAG} Connecting to OpenAI Realtime API…`);

      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        }
      );

      ws.on('open', () => {
        console.log(`[${ts()}] ${TAG} WebSocket open, configuring session…`);
        this.ws = ws;
        this.configureSession();
        resolve();
      });

      ws.on('message', (raw: WebSocket.RawData) => {
        try {
          const event = JSON.parse(raw.toString());
          this.handleEvent(event);
        } catch (err) {
          console.error(`[${ts()}] ${TAG} Failed to parse event:`, err);
        }
      });

      ws.on('error', (err) => {
        console.error(`[${ts()}] ${TAG} WebSocket error:`, err.message);
        reject(err);
      });

      ws.on('close', (code, reason) => {
        console.log(`[${ts()}] ${TAG} WebSocket closed: ${code} ${reason.toString()}`);
        this.ws = null;
        this.connectPromise = null;
        if (this.pending) {
          this.pending.reject(new Error('WebSocket closed'));
          this.pending = null;
        }
      });
    });
  }

  private configureSession() {
    this.send({
      type: 'session.update',
      session: {
        modalities: ['text'],
        instructions: buildInstructions(this.mode, this.customInstructions),
        input_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: null, // manual mode — we control when to get responses
        tools: [COACHING_TOOL],
        tool_choice: 'required',
        temperature: 0.6,
      },
    });
  }

  /** Update mode and custom instructions, reconfigure the live session */
  updateSettings(mode: string, customInstructions: string) {
    this.mode = mode;
    this.customInstructions = customInstructions;
    console.log(`[${ts()}] ${TAG} Settings updated — mode=${mode}, instructions=${customInstructions.length} chars`);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.configureSession();
    }
  }

  /**
   * Send a chunk of PCM16 audio and request coaching analysis.
   * The Realtime API is stateful — it remembers all prior audio.
   */
  async analyzeAudio(
    pcm16Base64: string
  ): Promise<{ transcript: string; data: PitchData }> {
    const callId = ++this.callCount;
    console.log(`[${ts()}] ${TAG} call #${callId} — ${pcm16Base64.length} base64 chars`);

    await this.ensureConnected();

    // Append audio to the conversation
    this.send({
      type: 'input_audio_buffer.append',
      audio: pcm16Base64,
    });

    // Commit the buffer (creates a user audio message)
    this.send({ type: 'input_audio_buffer.commit' });

    // Request a response (model will call provide_coaching)
    this.send({ type: 'response.create' });

    // Wait for the response
    return new Promise((resolve, reject) => {
      this.pending = {
        resolve,
        reject,
        startTime: performance.now(),
      };
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handleEvent(event: any) {
    switch (event.type) {
      case 'session.created':
        console.log(`[${ts()}] ${TAG} Session created: ${event.session?.id}`);
        break;

      case 'session.updated':
        console.log(`[${ts()}] ${TAG} Session configured`);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        // Whisper transcribed the user's audio input
        if (event.transcript) {
          this.pendingTranscript = event.transcript.trim();
          console.log(`[${ts()}] ${TAG} Transcription: "${this.pendingTranscript.slice(0, 100)}"`);
        }
        break;

      case 'response.function_call_arguments.delta':
        // Accumulate streaming function call arguments
        this.currentArgs += event.delta || '';
        break;

      case 'response.function_call_arguments.done':
        // Function call complete — parse the coaching data
        this.currentCallId = event.call_id || '';
        this.currentArgs = event.arguments || this.currentArgs;
        break;

      case 'response.done': {
        const elapsed = this.pending
          ? (performance.now() - this.pending.startTime).toFixed(0)
          : '?';

        // Acknowledge the function call so the conversation can continue
        if (this.currentCallId) {
          this.send({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: this.currentCallId,
              output: '{"status":"acknowledged"}',
            },
          });
        }

        if (!this.pending) {
          this.currentArgs = '';
          this.currentCallId = '';
          break;
        }

        try {
          const parsed = JSON.parse(this.currentArgs) as PitchData;

          // Update accumulated transcript
          if (this.pendingTranscript) {
            this.transcript += (this.transcript ? ' ' : '') + this.pendingTranscript;
          }

          console.log(
            `[${ts()}] ${TAG} COMPLETE in ${elapsed}ms — ` +
            `tips=[${parsed.tips.map(t => `"${t.text}"`).join(', ')}] ` +
            `signals=[${parsed.signals.map(s => `${s.label}:${s.value}`).join(', ')}]`
          );

          this.pending.resolve({
            transcript: this.transcript,
            data: parsed,
          });
        } catch (err) {
          console.error(`[${ts()}] ${TAG} Parse error:`, this.currentArgs.slice(0, 200));
          this.pending.reject(new Error('Failed to parse coaching response'));
        }

        this.pending = null;
        this.pendingTranscript = '';
        this.currentArgs = '';
        this.currentCallId = '';
        break;
      }

      case 'error':
        console.error(`[${ts()}] ${TAG} API error:`, event.error);
        if (this.pending) {
          this.pending.reject(
            new Error(event.error?.message || 'Realtime API error')
          );
          this.pending = null;
        }
        break;

      default:
        // Ignore other events (response.created, response.output_item.added, etc.)
        break;
    }
  }

  private send(event: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  /** Disconnect and reset state */
  disconnect() {
    console.log(`[${ts()}] ${TAG} Disconnecting…`);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectPromise = null;
    this.transcript = '';
    this.pendingTranscript = '';
    this.currentArgs = '';
    this.currentCallId = '';
    if (this.pending) {
      this.pending.reject(new Error('Disconnected'));
      this.pending = null;
    }
    this.callCount = 0;
  }
}
