import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RecognitionModelClient } from './recognition-model.client';

describe('RecognitionModelClient', () => {
  let client: RecognitionModelClient;
  let config: { get: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(async () => {
    config = { get: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [RecognitionModelClient, { provide: ConfigService, useValue: config }],
    }).compile();

    client = moduleRef.get(RecognitionModelClient);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('devolve null e nunca chama fetch quando ANTHROPIC_API_KEY não está configurada (app funciona sem a chave)', async () => {
    config.get.mockReturnValue(undefined);
    global.fetch = jest.fn();

    const result = await client.extractLabelText('base64img', 'image/jpeg');

    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('extrai brandGuess/lineGuess/rawText de uma resposta JSON válida do modelo', async () => {
    config.get.mockReturnValue('fake-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: 'text', text: '{"brandGuess":"Cohiba","lineGuess":"Línea Clásica","rawText":"COHIBA"}' }],
        }),
    }) as unknown as typeof fetch;

    const result = await client.extractLabelText('base64img', 'image/jpeg');

    expect(result).toEqual({ brandGuess: 'Cohiba', lineGuess: 'Línea Clásica', rawText: 'COHIBA' });
  });

  it('devolve null quando a chamada falha (erro de rede/timeout), sem lançar exceção', async () => {
    config.get.mockReturnValue('fake-key');
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as unknown as typeof fetch;

    const result = await client.extractLabelText('base64img', 'image/jpeg');

    expect(result).toBeNull();
  });

  it('devolve null quando a API responde com status de erro', async () => {
    config.get.mockReturnValue('fake-key');
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

    const result = await client.extractLabelText('base64img', 'image/jpeg');

    expect(result).toBeNull();
  });

  it('devolve null quando a resposta do modelo não é um JSON válido', async () => {
    config.get.mockReturnValue('fake-key');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text', text: 'não é json' }] }),
    }) as unknown as typeof fetch;

    const result = await client.extractLabelText('base64img', 'image/jpeg');

    expect(result).toBeNull();
  });
});
