import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ANTHROPIC_FETCH_TIMEOUT_MS, ANTHROPIC_MESSAGES_URL, ANTHROPIC_MODEL } from './recognition.constants';

export interface LabelExtraction {
  brandGuess: string | null;
  lineGuess: string | null;
  rawText: string | null;
}

const EXTRACTION_PROMPT = `Você está vendo a foto recortada da anilha (faixa de papel) de um charuto.
Extraia APENAS o texto visível e o nome de marca/linha que aparecem literalmente na anilha.
Nunca infira, deduza ou complete dados que não estejam literalmente escritos na imagem.
Se não tiver certeza de um campo, responda null para ele.
Responda em JSON estrito, sem nenhum texto adicional antes ou depois, exatamente neste formato:
{"brandGuess": string|null, "lineGuess": string|null, "rawText": string|null}`;

/**
 * Chamada HTTP simples (fetch nativo do Node 20) para a API de Messages da
 * Anthropic — nenhum SDK novo instalado, conforme exigido. Se
 * `ANTHROPIC_API_KEY` não estiver configurada ou a chamada falhar/der
 * timeout, devolve `null` e o processor segue direto para o fallback de
 * busca manual, sem nunca quebrar por falta de chave em dev/test.
 */
@Injectable()
export class RecognitionModelClient {
  private readonly logger = new Logger(RecognitionModelClient.name);

  constructor(private readonly config: ConfigService) {}

  async extractLabelText(imageBase64: string, mediaType: string): Promise<LabelExtraction | null> {
    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (!apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY não configurada — pulando reconhecimento por modelo multimodal');
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANTHROPIC_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
                { type: 'text', text: EXTRACTION_PROMPT },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(`Modelo multimodal respondeu ${response.status} — usando fallback de busca manual`);
        return null;
      }

      const payload = (await response.json()) as { content?: { type: string; text?: string }[] };
      const text = payload.content?.find((block) => block.type === 'text')?.text;
      if (!text) return null;

      return this.parseExtraction(text);
    } catch (error) {
      this.logger.warn(`Falha ao chamar o modelo multimodal: ${(error as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseExtraction(text: string): LabelExtraction | null {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const raw = JSON.parse(jsonMatch ? jsonMatch[0] : text) as Record<string, unknown>;
      return {
        brandGuess: typeof raw.brandGuess === 'string' ? raw.brandGuess : null,
        lineGuess: typeof raw.lineGuess === 'string' ? raw.lineGuess : null,
        rawText: typeof raw.rawText === 'string' ? raw.rawText : null,
      };
    } catch {
      this.logger.warn('Resposta do modelo multimodal não é um JSON válido — descartando extração');
      return null;
    }
  }
}
