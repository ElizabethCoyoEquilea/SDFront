import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export async function GET() {
  const rawKey = process.env.OPENAI_API_KEY || '';
  const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();
  return NextResponse.json({
    status: 'AI service online',
    hasKey: !!apiKey
  });
}

export async function POST(request: Request) {
  const rawKey = process.env.OPENAI_API_KEY || '';
  const apiKey = rawKey.replace(/^["']|["']$/g, '').trim();

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY no esta configurada en .env.local' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    // Permitir configurar el modelo por variable de entorno (.env.local) si existe, o usar un modelo predeterminado confiable
    if (process.env.OPENAI_MODEL) {
      body.model = process.env.OPENAI_MODEL;
    } else if (!body.model) {
      body.model = 'gpt-4o-mini';
    }

    // Normalizar parametros para compatibilidad con modelos modernos / reasoning
    if (body.max_tokens !== undefined && body.max_completion_tokens === undefined) {
      body.max_completion_tokens = body.max_tokens;
      delete body.max_tokens;
    }

    // Modelos de razonamiento (como o1, o3, luna) no aceptan temperature personalizada ni top_p
    const model = (body.model || '').toLowerCase();
    const isReasoningModel = model.includes('luna') || model.startsWith('o1') || model.startsWith('o3');

    if (isReasoningModel) {
      delete body.temperature;
      delete body.top_p;
    }

    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[API/AI] OpenAI API error:', response.status, data);
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    console.error('[API/AI] Internal error:', error);
    return NextResponse.json(
      { error: error?.message || 'No se pudo conectar con el servicio de IA.' },
      { status: 500 }
    );
  }
}