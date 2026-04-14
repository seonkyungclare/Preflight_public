import Anthropic from '@anthropic-ai/sdk'

// Low-fi: 그레이스케일 와이어프레임
const LOWFI_PROMPT = `You are a UX designer creating a low-fidelity wireframe prototype in React.

Rules:
- Start with: import React, { useState, useEffect } from 'react';
- Export a default function named App
- NEVER use const { useState } = React or require() — always use ES module import
- Wireframe style ONLY: grayscale palette (#f5f5f5 background, #e0e0e0 borders, #bdbdbd placeholders, #757575 labels, #212121 headings)
- Represent images/media as gray rectangles with an X through them (drawn with two diagonal lines via SVG or div)
- Use simple geometric shapes — no icons, no illustrations, no color accents
- Typography: system font (sans-serif), no web fonts
- Buttons: outlined rectangles with plain text labels, no shadows, no gradients
- No animations, no transitions, no hover effects
- Use placeholder text like "레이블", "버튼", "텍스트 영역" in Korean
- Show layout structure and hierarchy clearly — the goal is to communicate layout, not visual design
- Include key screens/states described in the PRD as separate sections or tabs
- The component must be runnable in a sandboxed environment with inline styles only — NO Tailwind, NO external CSS
- The generated code must be syntactically complete and valid.
- All brackets, curly braces, and parentheses must be properly closed and balanced.
- Do not truncate or omit any part of the code.
- Ensure the output is a fully functional React component with no syntax errors.

Return ONLY the component code, no markdown fences, no explanation.`

// Hi-fi: Ant Design 디자인 시스템 적용 — 구조는 PRD 기반으로 자유롭게
const HIFI_PROMPT = `You are a senior React developer creating a high-fidelity UI prototype using Ant Design.

## Structure
- Read the PRD carefully and choose the most appropriate layout and screen structure (do NOT force a fixed 3-tab or Sider layout — pick what fits the PRD)
- Use Ant Design components that match the PRD's domain (Table, Form, Card, Modal, Steps, etc.)
- Include realistic Korean placeholder data matching the PRD domain

## UX Requirements (apply wherever appropriate given the PRD)
- If the screen has a list: row click → open detail <Modal> with <Descriptions bordered>
- If there is a delete action: use <Modal.confirm> → remove from list via useState
- If there is a form: use <Form layout="vertical"> with validation rules and Korean error messages
- Loading state: show <Skeleton active> briefly on mount before content appears
- Empty state: show <Empty description="데이터가 없습니다"> with a CTA button
- Error state: show <Alert type="error"> when an error occurs

## Code Rules
- Start with: import React, { useState, useEffect } from 'react';
- NEVER use const { useState } = React or require() — always use ES module import
- Export a default function named App
- Use only React + antd — no Tailwind, no external CSS imports
- Import from 'antd' and '@ant-design/icons' as needed
- Wrap in <ConfigProvider> for consistent theming
- All text/labels in Korean
- The component must run in a sandboxed Sandpack environment

Return ONLY the component code, no markdown fences, no explanation.`

interface RequestBody {
  prdText: string
  analysisText: string
  type: 'lowfi' | 'hifi'
}

// 응답에서 실행 가능한 코드만 추출 — 설명 텍스트·마크다운 펜스 제거
function extractCode(output: string): string | null {
  // 마크다운 펜스 안의 코드 우선 추출
  const fenceMatch = output.match(/```(?:jsx?|tsx?)?\n([\s\S]*?)```/)
  if (fenceMatch) return fenceMatch[1].trim()

  // 펜스 없을 경우 import 또는 export default로 시작하는 줄부터 추출
  const lines = output.split('\n')
  const startIdx = lines.findIndex(l => /^import\s|^export\s+default\s/.test(l.trim()))
  if (startIdx !== -1) return lines.slice(startIdx).join('\n').trim()

  return null
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.anthropic_api_key
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY(또는 anthropic_api_key) 환경변수가 설정되어 있지 않습니다')
  }
  return new Anthropic({ apiKey })
}

function getAnthropicModelCandidates(): string[] {
  const configuredModel = process.env.ANTHROPIC_MODEL ?? process.env.anthropic_model
  const candidates = [
    configuredModel,
    'claude-sonnet-4-6',
    'claude-opus-4-6',
  ].filter(Boolean) as string[]
  const unique: string[] = []
  for (const m of candidates) {
    if (!unique.includes(m)) unique.push(m)
  }
  return unique
}

function extractText(content: Anthropic.Messages.Message['content']): string {
  return content
    .map(block => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim()
}

async function createMessageWithModelFallback(
  anthropic: Anthropic,
  params: Omit<Anthropic.Messages.MessageCreateParams, 'model' | 'stream'> & { stream?: false },
): Promise<Anthropic.Messages.Message> {
  const models = getAnthropicModelCandidates()
  let lastError: unknown

  for (const model of models) {
    try {
      const result = (await anthropic.messages.create({
        ...params,
        model,
        stream: false,
      })) as Anthropic.Messages.Message
      return result
    } catch (err) {
      lastError = err
      const anyErr = err as { status?: number; error?: unknown; message?: string }
      const message =
        typeof anyErr?.message === 'string'
          ? anyErr.message
          : typeof (anyErr as any)?.error?.error?.message === 'string'
            ? (anyErr as any).error.error.message
            : ''

      const isModelNotFound = anyErr?.status === 404 && message.includes('model:')
      if (isModelNotFound) {
        console.warn(`[mockup] 모델을 찾지 못해 다음 후보로 재시도합니다: ${model}`)
      }
      if (!isModelNotFound) break
    }
  }

  throw lastError
}

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json()

  if (
    typeof body !== 'object' ||
    body === null ||
    typeof (body as Record<string, unknown>).prdText !== 'string' ||
    typeof (body as Record<string, unknown>).analysisText !== 'string'
  ) {
    return Response.json({ error: 'prdText와 analysisText가 필요합니다' }, { status: 400 })
  }

  const { prdText, analysisText, type = 'lowfi' } = body as RequestBody
  const systemPrompt = type === 'hifi' ? HIFI_PROMPT : LOWFI_PROMPT

  const fullPrompt = `${systemPrompt}\n\nPRD:\n${prdText}\n\n분석 결과:\n${analysisText}\n\nPRD에서 가장 핵심적인 화면 하나만 React 컴포넌트로 구현해줘. 코드는 400줄 이내로 작성하고, 모든 괄호와 중괄호가 완전히 닫힌 문법적으로 완전한 코드를 작성해.`

  try {
    const anthropic = getAnthropicClient()
    const result = await createMessageWithModelFallback(anthropic, {
      max_tokens: 16000,
      temperature: type === 'hifi' ? 0.4 : 0.2,
      messages: [{ role: 'user', content: fullPrompt }],
    })

    const output = extractText(result.content)

    const code = extractCode(output)
    if (!code) {
      console.error('[mockup] 코드 추출 실패. 원본 출력:', output.slice(0, 200))
      return Response.json({ error: '응답에서 코드를 찾지 못했습니다' }, { status: 500 })
    }

    return Response.json({ code })
  } catch (error) {
    console.error('[mockup] Claude API 오류:', error)
    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return Response.json({ error: 'API 키가 필요합니다. 서버 환경변수 ANTHROPIC_API_KEY를 설정해주세요.' }, { status: 500 })
    }
    return Response.json({ error: '목업 생성 중 오류가 발생했습니다' }, { status: 500 })
  }
}
