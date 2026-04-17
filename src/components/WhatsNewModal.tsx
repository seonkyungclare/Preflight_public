"use client";

import { useChangelog } from "@/hooks/useChangelog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) dismiss() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">New</Badge>
            <span className="text-xs text-muted-foreground">v{version} · {latest.date}</span>
          </div>
          <DialogTitle>업데이트 내역</DialogTitle>
        </DialogHeader>

        <Separator />

        <ScrollArea className="max-h-72 pr-3">
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
        </ScrollArea>

        <Separator />

        <div className="flex justify-end pt-1">
          <Button size="sm" onClick={dismiss}>확인</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
