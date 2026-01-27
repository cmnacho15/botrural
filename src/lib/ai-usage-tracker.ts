// src/lib/ai-usage-tracker.ts
// Registra el consumo de tokens de IA (OpenAI y Claude)

import { prisma } from '@/lib/prisma'

type AIProvider = 'OPENAI' | 'CLAUDE'

type AIFeature =
  | 'MESSAGE_PARSER'      // Parseo de mensajes de WhatsApp
  | 'AUDIO_TRANSCRIPTION' // Whisper transcripción
  | 'FACTURA_PARSER'      // OCR de facturas/gastos
  | 'VENTA_PARSER'        // Parser de ventas (ganado, lana, granos)
  | 'FACTURA_DETECTOR'    // Detector tipo de factura
  | 'VENTA_DETECTOR'      // Detector tipo de venta
  | 'PAGO_PARSER'         // Parser de pagos

// Precios por 1M tokens (actualizar según pricing actual)
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'whisper-1': { input: 0.006, output: 0 }, // $0.006 por minuto, aproximamos por tokens

  // Claude
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
  'claude-3-sonnet-20240229': { input: 3.00, output: 15.00 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
  'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
}

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] || { input: 5.00, output: 15.00 } // fallback
  const inputCost = (inputTokens / 1_000_000) * pricing.input
  const outputCost = (outputTokens / 1_000_000) * pricing.output
  return inputCost + outputCost
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MetadataValue = any

interface TrackUsageParams {
  userId: string
  provider: AIProvider
  model: string
  feature: AIFeature
  inputTokens: number
  outputTokens: number
  metadata?: Record<string, MetadataValue>
}

/**
 * Registra el uso de IA en la base de datos
 */
export async function trackAIUsage({
  userId,
  provider,
  model,
  feature,
  inputTokens,
  outputTokens,
  metadata
}: TrackUsageParams): Promise<void> {
  try {
    const totalTokens = inputTokens + outputTokens
    const costUSD = calculateCost(model, inputTokens, outputTokens)

    await prisma.aIUsage.create({
      data: {
        userId,
        provider,
        model,
        feature,
        inputTokens,
        outputTokens,
        totalTokens,
        costUSD,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
      }
    })

    console.log(`📊 [AI-TRACKER] ${provider}/${model} - ${feature}: ${totalTokens} tokens ($${costUSD.toFixed(4)})`)
  } catch (error) {
    // No fallar si el tracking falla - es secundario
    console.error('⚠️ [AI-TRACKER] Error registrando uso:', error)
  }
}

/**
 * Helper para OpenAI Chat Completions
 */
export async function trackOpenAIChat(
  userId: string,
  feature: AIFeature,
  response: { model: string; usage?: { prompt_tokens: number; completion_tokens: number } },
  metadata?: Record<string, MetadataValue>
): Promise<void> {
  if (!response.usage) return

  await trackAIUsage({
    userId,
    provider: 'OPENAI',
    model: response.model,
    feature,
    inputTokens: response.usage.prompt_tokens,
    outputTokens: response.usage.completion_tokens,
    metadata
  })
}

/**
 * Helper para OpenAI Whisper (audio)
 * Whisper cobra por duración, estimamos tokens basado en texto
 */
export async function trackOpenAIWhisper(
  userId: string,
  transcriptionLength: number,
  metadata?: Record<string, MetadataValue>
): Promise<void> {
  // Estimación: ~4 caracteres por token
  const estimatedTokens = Math.ceil(transcriptionLength / 4)

  await trackAIUsage({
    userId,
    provider: 'OPENAI',
    model: 'whisper-1',
    feature: 'AUDIO_TRANSCRIPTION',
    inputTokens: estimatedTokens,
    outputTokens: 0,
    metadata
  })
}

/**
 * Helper para Claude/Anthropic
 */
export async function trackClaudeUsage(
  userId: string,
  feature: AIFeature,
  response: { model: string; usage: { input_tokens: number; output_tokens: number } },
  metadata?: Record<string, MetadataValue>
): Promise<void> {
  await trackAIUsage({
    userId,
    provider: 'CLAUDE',
    model: response.model,
    feature,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    metadata
  })
}
