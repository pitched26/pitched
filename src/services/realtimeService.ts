import WebSocket from 'ws';
import type { PitchData } from '../types/pitch';

function ts(): string {
  return new Date().toISOString();
}

const TAG = '[Realtime]';

const INSTRUCTIONS = `You are an expert speaking coach analyzing a live pitch via audio in real time. You can hear the speaker's voice directly — analyze BOTH what they say AND how they say it.

Listen for vocal sentiment and delivery cues:
- Confidence: steady voice vs. shaky, hedging language, upward inflections on statements
- Energy: vocal enthusiasm and conviction vs. flat/monotone delivery
- Pace: rushing through points, dragging, or well-paced with purposeful pauses
- Clarity: crisp articulation vs. mumbling, filler words (um, uh, like, you know)
- Emotion: genuine passion, nervousness, uncertainty, or rehearsed/robotic tone

When asked to provide coaching, call the provide_coaching function with hyper-specific feedback based on what you ACTUALLY HEARD. Each tip MUST reference a specific moment, word, phrase, vocal pattern, or behavior from the audio.

GOOD tip examples: "You said 'um' before every number — pause silently instead", "Your voice dropped to a mumble on pricing — project with conviction", "The pause after 'ten million' was powerful — use more like it"
BAD tip examples (NEVER output these): "Speak more clearly", "Be more confident", "Slow down your pace"`;

const COACHING_TOOL = {
  type: 'function' as const,
  name: 'provide_coaching',
  description: 'Provide real-time coaching feedback based on the speaker\'s audio',
  parameters: {
    type: 'object',
    required: ['tips', 'signals', 'coachNote'],
    properties: {
      tips: {
        type: 'array',
        description: '1-3 hyper-specific coaching tips referencing actual audio moments',
        items: {
          type: 'object',
          required: ['id', 'text', 'category', 'priority'],
          properties: {
            id: { type: 'string' },
            text: { type: 'string', description: 'Under 15 words, must reference something specific from the audio' },
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
        description: 'One vivid sentence about how the speaker sounds right now, citing something specific',
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
        instructions: INSTRUCTIONS,
        input_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: null, // manual mode — we control when to get responses
        tools: [COACHING_TOOL],
        tool_choice: 'required',
        temperature: 0.6,
      },
    });
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
