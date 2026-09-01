'use client'

import { useEffect, useState } from 'react'
import { Button as AstryxButton } from '@astryxdesign/core/Button'
import { Card as AstryxCard } from '@astryxdesign/core/Card'
import { Banner } from '@astryxdesign/core/Banner'

const ERROR_MESSAGES: Record<string, string> = {
  domain_not_allowed: '사내 계정이 아닙니다. 무신사 Atlassian 계정으로 로그인해 주세요.',
  no_email: 'Atlassian 계정에서 이메일을 확인하지 못했습니다. 프로필 이메일 공개 설정을 확인해 주세요.',
  state_mismatch: '로그인 요청이 만료되었습니다. 다시 시도해 주세요.',
  invalid_callback: '로그인 응답이 올바르지 않습니다. 다시 시도해 주세요.',
  token_exchange_failed: '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  access_denied: '로그인이 취소되었습니다.',
}

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [next, setNext] = useState('/')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    const error = params.get('error')
    if (error) {
      const detail = params.get('detail')
      const base = ERROR_MESSAGES[error] ?? `로그인에 실패했습니다 (${error})`
      setErrorMessage(detail ? `${base} (${detail})` : base)
    }

    const nextParam = params.get('next')
    if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) {
      setNext(nextParam)
    }
  }, [])

  function handleLogin() {
    window.location.href = `/api/auth/atlassian/login?next=${encodeURIComponent(next)}`
  }

  return (
    <div
      data-astryx-theme="neutral"
      className="min-h-screen flex flex-col items-center justify-center px-6 py-12 [&_button]:rounded-md"
    >
      <div className="mb-10 flex items-center gap-2">
        <span className="text-2xl font-bold tracking-tight">Preflight</span>
        <span className="text-xs text-muted-foreground mt-1">by Musinsa</span>
      </div>

      <h1 className="text-2xl font-bold text-center mb-3">사내 계정으로 로그인해 주세요</h1>
      <p className="text-muted-foreground text-center mb-8 text-sm">
        Preflight는 무신사 Atlassian 계정으로만 이용할 수 있습니다.
      </p>

      <div className="w-full max-w-sm">
        <AstryxCard padding={0}>
          <div className="flex flex-col gap-4 py-8 px-6">
            <AstryxButton
              variant="primary"
              size="lg"
              label="Atlassian 계정으로 로그인"
              onClick={handleLogin}
              style={{ width: '100%' }}
            />
            <p className="text-xs text-muted-foreground text-center">
              로그인하면 Confluence PRD 페이지도 바로 불러올 수 있습니다.
            </p>
          </div>
        </AstryxCard>

        {errorMessage && <Banner status="error" title={errorMessage} className="mt-3" />}
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        접근 권한 문의: MSSnP Product Design{' '}
        <a
          href="https://musinsa.slack.com/team/U08KNDY6HJ5"
          target="_blank"
          rel="noreferrer"
          className="text-foreground/70 hover:text-foreground underline"
        >
          김선경
        </a>
      </p>
    </div>
  )
}
