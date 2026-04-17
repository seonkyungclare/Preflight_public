"use client";

import { useChangelog } from "@/hooks/useChangelog";

// 업데이트 내역을 여기에 작성합니다.
// Claude Code에 "CHANGELOG에 항목 추가해줘" 라고 하면 됩니다.
const CHANGELOG = [
  {
    version: "1.2.0",
    date: "2025년 4월 16일",
    sections: [
      {
        type: "added" as const,
        items: ["MD 파일 업로드 지원", "목업 자동 생성 기능 추가"],
      },
      {
        type: "improved" as const,
        items: ["엣지케이스 탐지 정확도 향상", "PDF 파싱 속도 개선"],
      },
      {
        type: "fixed" as const,
        items: ["대용량 파일 업로드 시 오류 수정"],
      },
    ],
  },
];

const SECTION_META = {
  added:    { label: "추가", color: "#16a34a", bg: "#f0fdf4", dot: "#22c55e" },
  improved: { label: "개선", color: "#2563eb", bg: "#eff6ff", dot: "#60a5fa" },
  fixed:    { label: "수정", color: "#dc2626", bg: "#fef2f2", dot: "#f87171" },
};

export function WhatsNewModal() {
  const { isOpen, dismiss, version } = useChangelog();
  const latest = CHANGELOG[0];

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "440px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem 1rem",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  background: "#eff6ff",
                  color: "#2563eb",
                  padding: "2px 8px",
                  borderRadius: "99px",
                }}
              >
                New
              </span>
              <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                v{version} · {latest.date}
              </span>
            </div>
            <p style={{ fontSize: "16px", fontWeight: 600, margin: 0, color: "#111" }}>
              업데이트 내역
            </p>
          </div>
          <button
            onClick={dismiss}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              color: "#9ca3af",
              cursor: "pointer",
              padding: 0,
              lineHeight: 1,
              marginTop: "2px",
            }}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: "1rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            maxHeight: "320px",
            overflowY: "auto",
          }}
        >
          {latest.sections.map((section) => {
            const meta = SECTION_META[section.type];
            return (
              <div key={section.type}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: meta.dot,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: meta.color,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <ul
                  style={{
                    margin: "0 0 0 12px",
                    padding: 0,
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                  }}
                >
                  {section.items.map((item) => (
                    <li
                      key={item}
                      style={{
                        position: "relative",
                        paddingLeft: "12px",
                        fontSize: "13px",
                        color: "#374151",
                        lineHeight: 1.7,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          color: "#9ca3af",
                        }}
                      >
                        –
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "0.875rem 1.5rem",
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={dismiss}
            style={{
              fontSize: "13px",
              padding: "6px 20px",
              background: "#111",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
