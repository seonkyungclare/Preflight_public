"use client";

import { useChangelog } from "@/hooks/useChangelog";
// astryx 실제 컴포넌트 (StyleX 런타임 + astryx.css)
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Button as AstryxButton } from "@astryxdesign/core/Button";
import { Badge as AstryxBadge } from "@astryxdesign/core/Badge";
import { Divider as AstryxDivider } from "@astryxdesign/core/Divider";

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
  added:    { label: "추가", dotClass: "bg-green-500" },
  improved: { label: "개선", dotClass: "bg-blue-500" },
  fixed:    { label: "수정", dotClass: "bg-destructive" },
};

export function WhatsNewModal() {
  const { isOpen, dismiss, version } = useChangelog();
  const latest = CHANGELOG[0];
  const handleOpenChange = (open: boolean) => { if (!open) dismiss(); };

  return (
    // astryx Dialog 는 native <dialog>+showModal 로 top-layer 렌더 → 테마 토큰 해석 위해
    // data-astryx-theme 를 Dialog 에 직접 부여
    <Dialog
      data-astryx-theme="neutral"
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogHeader
        title="업데이트 내역"
        subtitle={`v${version} · ${latest.date}`}
        onOpenChange={handleOpenChange}
        startContent={<AstryxBadge variant="info" label="New" />}
        hasDivider
      />
      <div className="max-h-72 overflow-y-auto pr-3 scrollbar-hide">
        <div className="flex flex-col gap-4 py-2">
          {latest.sections.map((section) => {
            const meta = SECTION_META[section.type];
            return (
              <div key={section.type}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${meta.dotClass}`} />
                  <span className="text-xs font-semibold">{meta.label}</span>
                </div>
                <ul className="ml-3 space-y-0.5 list-none">
                  {section.items.map((item) => (
                    <li key={item} className="text-sm text-muted-foreground relative pl-3">
                      <span className="absolute left-0 text-muted-foreground">–</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <AstryxDivider />

      <div className="flex justify-end pt-1">
        <AstryxButton variant="primary" size="sm" label="확인" onClick={dismiss} />
      </div>
    </Dialog>
  );
}
