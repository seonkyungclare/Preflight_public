// AUTO-GENERATED — MCDS 공용 스타일 임베드본. 직접 수정하지 말 것.
// 원본: mcds-campaign-dashboard/pages/mcds.css
// 재생성: npm run sync:mcds  (원본 mcds.css 수정 후 반드시 실행)
// Hi-Fi 목업 Sandpack에 정적 파일(/mcds.css)로 주입된다.
/* eslint-disable */
export const MCDS_CSS = String.raw`
/* ============================================================
   MCDS (MUSINSA Design System) — 공용 스타일
   src/tokens.ts 및 Figma 변수 매핑. 캠페인/광고그룹 생성 화면 공용.
   ============================================================ */
:root {
  /* Foreground */
  --fg-default: #1a1a1a;   /* gray/10 */
  --fg-subtle: #666666;    /* gray/40 */
  --fg-muted: #808080;     /* gray/50 */
  --fg-on-accent: #ffffff;
  --fg-header: #333333;
  --fg-black: #000000;

  --fg-disabled: #b3b3b3;

  /* Fill */
  --fill-light: #ffffff;
  --fill-subtle: #f7f7f7;
  --fill-disabled: #f2f2f2;
  --fill-gray-98: #fafafa;
  --fill-light-hovered: #f2f2f2;      /* semantic/fill-light-hovered */
  --fill-light-pressed: #e6e6e6;      /* semantic/fill-light-pressed */
  --fill-light-lower: #f2f2f2;        /* semantic/fill-light-lower */
  --fill-light-lower-hovered: #e6e6e6;
  --fill-light-low: #fafafa;          /* semantic/fill-light-low */
  --overlay-floating: #333333;        /* semantic/overlay-floating (Tooltip 배경) */

  /* Accent */
  --accent: #2b52f0;           /* blue/40 primary */
  --accent-hovered: #1a40d9;
  --accent-pressed: #1e34b3;
  --accent-disabled: #bacbff;
  --accent-bg-low: #f7faff;    /* semantic/bg-accent-low */
  --accent-light-low: #edf3ff;      /* semantic/fill-accent-light-low */
  --accent-light-hovered: #dbe6ff;  /* semantic/fill-accent-light-hovered */
  --accent-light-pressed: #bacbff;  /* semantic/fill-accent-light-pressed */
  --blue-70: #99b1ff;
  --blue-90: #dbe6ff;
  --blue-95: #edf3ff;

  /* Border */
  --border: #d9d9d9;       /* gray/85 = semantic/border-light-lower */
  --border-light: #ececec;
  --border-light-lower-hovered: #cccccc;
  --border-strong: #999999;
  --border-disabled: #e6e6e6;
  --border-accent-light: #bacbff;   /* semantic/border-accent-light */
  --divider: #cccccc;      /* gray/80 */

  /* Status — critical (Button "warning" maps to critical) */
  --critical: #e5231b;
  --critical-fg: #fc3f45;
  --critical-border: #eb0517;
  --critical-fg-hovered: #cc0414;
  --critical-fill-hovered: #ffe2df;
  --critical-fg-pressed: #ab1215;
  --critical-fill-pressed: #ffc5c0;

  /* Typography */
  --font: 'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  /* Radius */
  --r-4: 4px;
  --r-8: 8px;

  /* Layout */
  --gnb-h: 52px;
  --lnb-w: 210px;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: var(--font);
  color: var(--fg-default);
  background: var(--fill-light);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  min-width: 1024px;
}
p { margin: 0; }
button { font-family: inherit; }

/* ===================== GNB ===================== */
.gnb {
  position: sticky;
  top: 0;
  z-index: 30;
  height: var(--gnb-h);
  display: flex;
  align-items: center;
  padding: 0 20px;
  background: var(--fill-light);
  border-bottom: 1px solid var(--border);
}
.gnb__logo { display: flex; align-items: center; height: var(--gnb-h); }
.gnb__logo svg { display: block; height: 14px; width: auto; }
.gnb__menu { flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
.gnb__link { font-size: 14px; line-height: 20px; font-weight: 500; color: var(--fg-header); cursor: pointer; }
.gnb__divider { width: 1px; height: 12px; background: var(--divider); }

/* ===================== Layout ===================== */
.layout { display: flex; align-items: flex-start; }

/* ===================== LNB ===================== */
.lnb {
  position: sticky;
  top: var(--gnb-h);
  align-self: flex-start;
  flex: 0 0 var(--lnb-w);
  width: var(--lnb-w);
  min-height: calc(100vh - var(--gnb-h));
  background: var(--fill-light);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}
.lnb__partner { display: flex; align-items: center; gap: 24px; padding: 16px 16px 24px; }
.lnb__partner-name { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--fg-black); }
.lnb__list { background: var(--fill-gray-98); padding: 4px; display: flex; flex-direction: column; gap: 2px; }
.nav-item { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px 0 20px; border-radius: var(--r-8); cursor: pointer; }
.nav-item__label {
  flex: 1; min-width: 0;
  font-size: 14px; line-height: 20px; font-weight: 400;
  color: rgba(0, 0, 0, 0.88);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.nav-item:hover { background: var(--blue-95); }
.nav-item--active { background: var(--blue-95); }
.nav-item--active .nav-item__label { color: var(--accent); font-weight: 500; }
.nav-item__chevron { flex: 0 0 12px; width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; }
.lnb__guide { display: flex; align-items: center; gap: 4px; height: 40px; padding: 0 20px; }
.lnb__guide-label { font-size: 14px; line-height: 22px; color: rgba(0, 0, 0, 0.88); }

/* ===================== Main ===================== */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: calc(100vh - var(--gnb-h)); }
.content { flex: 1; display: flex; flex-direction: column; gap: 32px; align-items: flex-start; padding: 32px 32px 80px; }
.content__inner { width: 100%; max-width: 1326px; display: flex; flex-direction: column; gap: 32px; }
.page-title { font-size: 24px; line-height: 34px; font-weight: 700; color: var(--fg-default); }

/* ===================== Section ===================== */
/* section title ↔ 상세 속성(폼) 간격 16px, 상세 속성끼리는 .form gap 12px */
.section { display: flex; flex-direction: column; gap: 16px; width: 100%; }

/* 광고 그룹 생성: 캠페인 정보 ↔ 섹션그룹 = 32px(구분선 중앙), 섹션끼리 = 24px(구분선 중앙) */
.ag-body { display: flex; flex-direction: column; gap: 16px; width: 100%; }
.ag-sections { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.section__title { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600; color: var(--fg-default); }
.divider { height: 1px; background: var(--border-light); border: 0; margin: 0; width: 100%; }

/* Campaign info header */
.camp-info { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.camp-info__label { font-size: 16px; line-height: 24px; font-weight: 600; color: var(--fg-default); }
.camp-info__name-row { display: flex; align-items: center; gap: 8px; }
.camp-info__name { font-size: 18px; line-height: 26px; font-weight: 600; color: var(--fg-default); }
.camp-info__select {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: 1px solid var(--border); border-radius: var(--r-4);
  background: var(--fill-light); cursor: pointer;
}
.camp-info__tags { display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 18px; color: var(--fg-muted); }
.camp-info__tags span:not(:last-child)::after { content: ""; }
.camp-info__tag-sep { color: var(--border); }

/* ===================== Form rows ===================== */
.form { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.row { display: flex; gap: 8px; align-items: flex-start; }
.row__label { flex: 0 0 140px; width: 140px; max-width: 140px; min-height: 36px; display: flex; align-items: center; }
.row__label span { font-size: 14px; line-height: 20px; font-weight: 500; color: var(--fg-subtle); white-space: nowrap; }
.req { color: var(--accent); margin-left: 2px; }
.row__field { flex: 1; min-width: 0; }
.help { font-size: 12px; line-height: 18px; color: var(--fg-muted); }
.help--pad { padding: 0 2px; }

/* ===================== TextField ===================== */
.textfield { display: flex; flex-direction: column; gap: 4px; width: 100%; }
.textfield__box {
  display: flex; align-items: center; gap: 8px; height: 36px; padding: 0 8px;
  background: var(--fill-light); border: 1px solid var(--border); border-radius: var(--r-4);
}
.textfield__box:focus-within { border-color: var(--accent); }
.textfield__box.is-disabled { background: var(--fill-disabled); border-color: var(--border); }
.textfield__input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
  font-family: inherit; font-size: 14px; line-height: 20px; color: var(--fg-default); padding: 0;
}
.textfield__input::placeholder { color: var(--fg-muted); }
.textfield__input:disabled { color: var(--fg-default); -webkit-text-fill-color: var(--fg-default); }
.textfield__help { display: flex; justify-content: flex-end; padding: 0 2px; }
.textfield__help--between { justify-content: space-between; }
.textfield__count { font-size: 12px; line-height: 18px; color: var(--fg-muted); }

/* Numeric field with unit suffix */
.num-field { display: flex; flex-direction: column; gap: 4px; }
.num-field__row { display: flex; align-items: center; gap: 8px; }
.num-field__box { width: 167.5px; }
.num-field__box .textfield__input { text-align: right; }
.num-field__unit { font-size: 14px; line-height: 20px; color: var(--fg-default); }

/* ===================== Radio ===================== */
.radio-group { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.radio {
  display: inline-flex; align-items: center; gap: 8px; height: 36px;
  background: none; border: 0; padding: 0; cursor: pointer;
}
.radio:disabled { cursor: not-allowed; }
/* CSS-driven radio dot: white circle + gray border; accent fill + white dot when [data-on]. */
.radio__dot {
  position: relative; box-sizing: border-box; flex: 0 0 20px; width: 20px; height: 20px;
  border-radius: 50%; background: var(--fill-light); border: 1.5px solid var(--border);
  transition: background-color 120ms ease, border-color 120ms ease;
}
.radio:hover .radio__dot,
.radio-box:hover .radio-box__head .radio__dot { border-color: var(--accent-hovered); }
.radio__dot[data-on] {
  background: var(--accent); border-color: var(--accent);
}
.radio:hover .radio__dot[data-on],
.radio-box:hover .radio-box__head .radio__dot[data-on] { background: var(--accent-hovered); border-color: var(--accent-hovered); }
.radio__dot[data-on]::after {
  content: ""; position: absolute; top: 50%; left: 50%; width: 8px; height: 8px;
  transform: translate(-50%, -50%); border-radius: 50%; background: var(--fill-light);
}
.radio:disabled .radio__dot { background: var(--fill-disabled); border-color: var(--border-disabled); }
.radio:disabled .radio__dot[data-on] { background: var(--accent-disabled); border-color: transparent; }
.radio__label { font-size: 14px; line-height: 22px; font-weight: 400; color: var(--fg-default); white-space: nowrap; }
.radio:disabled .radio__label { color: var(--fg-disabled); }

/* Radio card (구매 유형 / 타겟팅 설정) */
.radio-card {
  display: flex; flex-direction: column; gap: 4px; padding: 20px;
  border: 1px solid var(--border); border-radius: var(--r-8); background: var(--fill-light);
  cursor: pointer; text-align: left;
}
.radio-card--selected { border-color: var(--accent); }
.radio-card__head { display: flex; align-items: center; gap: 8px; min-height: 22px; }
.radio-card__title { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--fg-default); }
.radio-card__desc { padding-left: 28px; font-size: 14px; line-height: 20px; font-weight: 400; color: var(--fg-muted); }

/* ===================== Checkbox ===================== */
/* Figma matrix: type(selected/unselected/indeterminate) × state(enabled/hovered/disabled). box radius 2. */
.checkbox { display: inline-flex; align-items: center; gap: 8px; height: 36px; background: none; border: 0; padding: 0; cursor: pointer; }
.checkbox--h20 { height: 20px; }
.checkbox:disabled { cursor: not-allowed; }
.checkbox__box {
  position: relative; box-sizing: border-box; flex: 0 0 20px; width: 20px; height: 20px; border-radius: 2px;
  border: 1.5px solid var(--border); background: var(--fill-light);
  display: flex; align-items: center; justify-content: center;
  transition: background-color 120ms ease, border-color 120ms ease;
}
.checkbox__box svg { display: none; width: 12px; height: 12px; }
/* hover (unselected / indeterminate box) → accent border */
.checkbox:hover .checkbox__box,
.checkbox--indeterminate:hover .checkbox__box { border-color: var(--accent-hovered); }
/* selected (filled) — also driven by ancestor .slot-card--selected or .checkbox--checked */
.checkbox[aria-checked="true"] .checkbox__box,
.checkbox--checked .checkbox__box,
.slot-card--selected .checkbox__box { background: var(--accent); border-color: var(--accent); }
.checkbox[aria-checked="true"] .checkbox__box svg,
.checkbox--checked .checkbox__box svg,
.slot-card--selected .checkbox__box svg { display: block; }
.checkbox:hover[aria-checked="true"] .checkbox__box,
.checkbox--checked:hover .checkbox__box,
.slot-card--selected:hover .checkbox__box { background: var(--accent-hovered); border-color: var(--accent-hovered); }
/* indeterminate — light box + accent inner square (overrides filled) */
.checkbox--indeterminate .checkbox__box { background: var(--fill-light); border-color: var(--border); }
.checkbox--indeterminate .checkbox__box svg { display: none; }
.checkbox--indeterminate .checkbox__box::after {
  content: ""; width: 8px; height: 8px; border-radius: 1px; background: var(--accent);
}
/* disabled */
.checkbox:disabled .checkbox__box,
.checkbox--disabled .checkbox__box { background: var(--fill-disabled); border-color: var(--border-disabled); }
.checkbox:disabled[aria-checked="true"] .checkbox__box,
.checkbox--checked.checkbox--disabled .checkbox__box { background: var(--accent-disabled); border-color: transparent; }
.checkbox--indeterminate.checkbox--disabled .checkbox__box::after { background: var(--accent-disabled); }
.checkbox__label { font-size: 14px; line-height: 20px; color: var(--fg-default); white-space: nowrap; }
.checkbox:disabled .checkbox__label,
.checkbox--disabled .checkbox__label { color: var(--fg-disabled); }

/* ===================== Slot type cards (구좌 유형) =====================
   Figma 상태 규칙: Selected / Normal / Disabled / Readonly (node 2723-335459) */
.slot-cards { display: flex; gap: 8px; width: 100%; }
/* Normal(기본): 배경 #f2f2f2(gray-95), 테두리 없음 */
.slot-card {
  position: relative;
  flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px;
  padding: 16px 20px;
  border: 1px solid transparent; border-radius: var(--r-8); background: var(--fill-light-lower);
  cursor: pointer; text-align: left;
}
.slot-card__img { height: 206px; border-radius: var(--r-4); overflow: hidden; background: var(--fill-light); }
.slot-card__img img { display: block; width: 100%; height: 100%; object-fit: cover; }
.slot-card__body { display: flex; flex-direction: column; gap: 8px; }
.slot-card__desc { font-size: 14px; line-height: 20px; color: var(--fg-muted); }

/* Selected — 연파랑 배경(#edf3ff) + 라이트블루 테두리(#bacbff) + 체크 */
.slot-card--selected { background: var(--accent-light-low); border-color: var(--border-accent-light); }

/* Disabled — 배경/테두리는 Normal과 동일, 체크박스 비활성 + 구좌명 흐림(#b8b8b8) */
.slot-card--disabled { cursor: not-allowed; }
.slot-card--disabled .checkbox { cursor: not-allowed; }
.slot-card--disabled .checkbox__box { background: var(--fill-disabled); border-color: var(--border); }
.slot-card--disabled .checkbox__box svg { display: none; }
.slot-card--disabled .checkbox__label { color: #b8b8b8; }

/* Readonly — 배경/테두리는 Normal과 동일, 체크박스 없이 구좌명만 표시 */
.slot-card--readonly { cursor: default; }
.slot-card--readonly .checkbox { cursor: default; }
.slot-card--readonly .checkbox__box { display: none; }

/* Disabled 카드에 hover하면 내부 tooltip 노출 */
.slot-card--disabled:hover > .tooltip { opacity: 1; visibility: visible; }

/* ===================== Tooltip (MCDS Tooltip / Compact) =====================
   다크 오버레이(#333) 버블 + 방향 화살표. position × tone(default/error).
   부모에 position:relative 필요. 기본 position=top. (node 9753-75532) */
.tooltip {
  --tt-bg: var(--overlay-floating);
  position: absolute; z-index: 60; width: max-content; max-width: 320px;
  padding: 12px; border-radius: var(--r-4);
  background: var(--tt-bg); color: var(--fg-on-accent);
  font-size: 14px; line-height: 20px; font-weight: 400; text-align: left;
  opacity: 0; visibility: hidden; pointer-events: none;
  transition: opacity 120ms ease, visibility 120ms ease;
  /* 기본 position = top */
  bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%);
}
.tooltip--error { --tt-bg: var(--critical); }
.tooltip::after {
  content: ""; position: absolute; width: 0; height: 0; border: 4px solid transparent;
  top: 100%; left: 50%; margin-left: -4px; border-top-color: var(--tt-bg);
}

/* top-start / top-end : 아래 배치 유지, 가로 정렬만 이동 */
.tooltip--top-start { left: 0; transform: none; }
.tooltip--top-start::after { left: 16px; }
.tooltip--top-end { left: auto; right: 0; transform: none; }
.tooltip--top-end::after { left: auto; right: 16px; margin-left: 0; }

/* bottom */
.tooltip--bottom { top: calc(100% + 6px); bottom: auto; left: 50%; transform: translateX(-50%); }
.tooltip--bottom-start { top: calc(100% + 6px); bottom: auto; left: 0; transform: none; }
.tooltip--bottom-end { top: calc(100% + 6px); bottom: auto; left: auto; right: 0; transform: none; }
.tooltip--bottom::after, .tooltip--bottom-start::after, .tooltip--bottom-end::after {
  top: auto; bottom: 100%; border-top-color: transparent; border-bottom-color: var(--tt-bg);
}
.tooltip--bottom-start::after { left: 16px; }
.tooltip--bottom-end::after { left: auto; right: 16px; margin-left: 0; }

/* left / right */
.tooltip--left { top: 50%; bottom: auto; left: auto; right: calc(100% + 6px); transform: translateY(-50%); }
.tooltip--left::after { top: 50%; left: 100%; margin: -4px 0 0 0; border-top-color: transparent; border-left-color: var(--tt-bg); }
.tooltip--right { top: 50%; bottom: auto; left: calc(100% + 6px); right: auto; transform: translateY(-50%); }
.tooltip--right::after { top: 50%; left: auto; right: 100%; margin: -4px 0 0 0; border-top-color: transparent; border-right-color: var(--tt-bg); }

/* ===================== DatePicker ===================== */
.datepicker {
  display: inline-flex; align-items: center; gap: 8px; height: 36px; width: 167.5px; padding: 0 8px;
  background: var(--fill-light); border: 1px solid var(--border); border-radius: var(--r-4);
}
.datepicker__input {
  flex: 1; min-width: 0; border: 0; outline: 0; background: transparent;
  font-family: inherit; font-size: 14px; line-height: 20px; color: var(--fg-default); padding: 0;
}
.datepicker__input::placeholder { color: var(--fg-muted); }
.datepicker__icon { flex: 0 0 16px; width: 16px; height: 16px; color: var(--fg-muted); }
.date-range { display: flex; align-items: center; gap: 8px; }
.date-range__tilde { font-size: 14px; color: var(--fg-muted); }

/* ===================== Callout ===================== */
.callout {
  display: flex; flex-direction: column; gap: 4px; width: 100%;
  background: var(--accent-bg-low); border: 1px solid var(--blue-90); border-radius: var(--r-8);
  padding: 16px 20px;
}
.callout__title { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--accent); }
.callout__value { font-size: 14px; line-height: 20px; color: var(--fg-default); }
.callout__value b { font-weight: 600; }
.callout__sub { font-size: 12px; line-height: 18px; color: var(--fg-muted); }

/* Guide line (구매 유형 하단 안내) */
.guide { display: flex; align-items: center; justify-content: flex-start; gap: 4px; }
.guide__icon { flex: 0 0 16px; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; }
.guide__text { font-size: 14px; line-height: 20px; color: var(--accent); white-space: nowrap; }

/* Bulleted help list */
.bullets { margin: 0; padding-left: 18px; list-style: disc; color: var(--fg-muted); }
.bullets li { font-size: 12px; line-height: 18px; }

/* Field stacks */
.field-stack { display: flex; flex-direction: column; gap: 20px; width: 100%; }
.purchase { display: flex; flex-direction: column; gap: 12px; width: 656px; max-width: 100%; }
.purchase__cards { display: flex; gap: 8px; }
.purchase__cards .radio-card { flex: 1; }

/* Info panel (구매 유형 안내 3열) */
.info { background: var(--accent-bg-low); border-radius: var(--r-8); padding: 32px; width: 656px; max-width: 100%; }
.info__row { display: flex; gap: 32px; align-items: flex-start; }
.info__item { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.info__title { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--fg-black); }
.info__desc { font-size: 12px; line-height: 18px; font-weight: 500; color: var(--fg-muted); text-align: justify; }
.info__text { display: flex; flex-direction: column; gap: 4px; }
.gicon { position: relative; width: 52px; height: 52px; overflow: hidden; }
.gicon > span { position: absolute; display: block; }
.gicon svg { display: block; width: 100%; height: 100%; }

/* Targeting rows (라벨 100px 정렬) */
.trow { display: flex; gap: 8px; align-items: flex-start; }
.trow__label { flex: 0 0 100px; width: 100px; min-height: 36px; display: flex; align-items: center; }
.trow__label span { font-size: 14px; line-height: 20px; font-weight: 500; color: var(--fg-subtle); }

/* ===================== Bottom bar ===================== */
.bottombar {
  position: sticky; bottom: 0; z-index: 20;
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 16px 32px; background: var(--fill-light); border-top: 1px solid var(--border);
}
/* Figma matrix: type(primary/secondary/tertiary/warning) × size(32/36/40/48) × state × content(basic/iconOnly). */
.btn {
  box-sizing: border-box; height: 40px; display: inline-flex; align-items: center; justify-content: center;
  gap: 6px; padding: 0 16px; border-radius: var(--r-4); font-size: 16px; line-height: 24px; font-weight: 400;
  cursor: pointer; border: 1px solid transparent; white-space: nowrap; text-decoration: none;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}
/* sizes */
.btn--32 { height: 32px; padding: 0 12px; gap: 4px; font-size: 14px; line-height: 20px; font-weight: 400; }
.btn--36, .btn--sm { height: 36px; padding: 0 12px; gap: 4px; font-size: 14px; line-height: 20px; font-weight: 400; }
.btn--40 { height: 40px; padding: 0 16px; gap: 6px; font-size: 16px; line-height: 24px; font-weight: 400; }
.btn--48 { height: 48px; padding: 0 20px; gap: 6px; font-size: 16px; line-height: 24px; font-weight: 600; }
.btn--icon { padding: 0; aspect-ratio: 1; }
/* type: primary (solid) */
.btn--primary { background: var(--accent); color: var(--fg-on-accent); border-color: transparent; }
.btn--primary:hover { background: var(--accent-hovered); }
.btn--primary:active { background: var(--accent-pressed); }
/* type: secondary (light + border) */
.btn--secondary { background: var(--fill-light); border-color: var(--border); color: var(--fg-default); }
.btn--secondary:hover { background: var(--fill-light-hovered); border-color: var(--border-light-lower-hovered); }
.btn--secondary:active { background: var(--fill-light-pressed); border-color: var(--border-light-lower-hovered); }
/* type: tertiary (accent outline) */
.btn--tertiary { background: transparent; border-color: var(--accent); color: var(--accent); }
.btn--tertiary:hover { background: var(--accent-light-hovered); border-color: var(--accent-hovered); color: var(--accent-hovered); }
.btn--tertiary:active { background: var(--accent-light-pressed); border-color: var(--accent-pressed); color: var(--accent-pressed); }
/* type: warning (critical outline) */
.btn--warning { background: transparent; border-color: var(--critical-border); color: var(--critical-fg); }
.btn--warning:hover { background: var(--critical-fill-hovered); border-color: var(--critical-fg-hovered); color: var(--critical-fg-hovered); }
.btn--warning:active { background: var(--critical-fill-pressed); border-color: var(--critical-fg-pressed); color: var(--critical-fg-pressed); }
/* disabled (uniform gray; outline types keep transparent fill) */
.btn[disabled], .btn.is-disabled {
  background: var(--fill-disabled); border-color: var(--border-disabled);
  color: var(--fg-disabled); cursor: not-allowed;
}
.btn--primary[disabled], .btn--primary.is-disabled { border-color: transparent; }
.btn--tertiary[disabled], .btn--tertiary.is-disabled,
.btn--warning[disabled], .btn--warning.is-disabled { background: transparent; border-color: var(--border-disabled); }

/* ============================================================
   광고 생성(소재 등록) 화면 전용
   ============================================================ */

/* 라벨 톤 (gray/30) */
.form--creative .row__label span { color: #4d4d4d; }

/* 2단 레이아웃: 좌 폼 + 우 미리보기 */
.cols { display: flex; gap: 16px; align-items: flex-start; width: 100%; }
.col-main { flex: 1; min-width: 0; max-width: 900px; display: flex; flex-direction: column; gap: 24px; }
.col-preview { flex: 0 0 410px; width: 410px; }

/* 라디오 박스(구좌 선택) */
.radio-box {
  width: 100%; display: flex; align-items: flex-start; gap: 12px; flex-direction: column;
  padding: 20px; border: 1px solid var(--border); border-radius: var(--r-8);
  background: var(--fill-light); cursor: pointer; text-align: left;
}
.radio-box--selected { border-color: var(--accent); }
.radio-box__head { display: flex; align-items: center; gap: 8px; }
.radio-box__title { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--fg-default); }
.radio-box__chips { display: flex; flex-wrap: wrap; gap: 4px; padding-left: 28px; width: 100%; }

/* 칩 (Chip / Element) — tone(default/accent/low) × size(24/28/32) × border × state.
   base = tone default, size 28, border=false. */
.chip {
  display: inline-flex; align-items: center; gap: 2px; box-sizing: border-box;
  height: 28px; padding: 0 8px; background: var(--fill-light-lower);
  border: 1px solid transparent; border-radius: var(--r-4);
  font-size: 14px; line-height: 20px; color: var(--fg-default); white-space: nowrap;
}
.chip--24 { height: 24px; font-size: 12px; line-height: 16px; }
.chip--32 { height: 32px; }
/* tone */
.chip--accent { background: var(--accent-light-low); color: var(--accent); }
.chip--low { color: var(--fg-muted); }
/* outlined (border=true) */
.chip--border { background: var(--fill-light-low); border-color: var(--border); }
.chip--accent.chip--border { background: var(--accent-light-low); border-color: var(--border-accent-light); }
.chip--low.chip--border { background: var(--fill-light-low); border-color: var(--border); }
/* disabled */
.chip--disabled { background: var(--fill-disabled); color: var(--fg-disabled); border-color: transparent; }
.chip--disabled.chip--border { background: transparent; border-color: var(--border-disabled); }
/* remove (✕) */
.chip__remove {
  display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px;
  margin-left: 2px; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer;
}
.chip__remove svg { display: block; width: 100%; height: 100%; }

/* 업로드 */
.upload-btn { width: 270px; gap: 6px; }
.upload-help { display: flex; flex-direction: column; gap: 2px; margin-top: 8px; }
.upload-help ul { margin: 0; padding-left: 16px; list-style: disc; }
.upload-help li { font-size: 12px; line-height: 18px; color: var(--fg-muted); }

/* 첨부 후 파일 미리보기 */
.file-preview { display: flex; flex-direction: column; gap: 8px; }
.file-preview__img {
  width: 360px; max-width: 100%; aspect-ratio: 1029 / 900; border-radius: var(--r-4);
  overflow: hidden; background: var(--fill-subtle);
}
.file-preview__img img { display: block; width: 100%; height: 100%; object-fit: cover; }
.file-preview__name { font-size: 14px; line-height: 22px; font-weight: 500; color: var(--fg-default); }
.file-preview__meta { font-size: 12px; line-height: 18px; color: var(--fg-muted); }

/* 미리보기 카드 */
.preview-card {
  background: var(--fill-subtle); border-radius: var(--r-8); padding: 20px;
  display: flex; flex-direction: column; gap: 16px;
}
.preview-card__title { font-size: 14px; line-height: 20px; font-weight: 600; color: var(--fg-default); }
.preview-card__caption { font-size: 12px; line-height: 18px; color: var(--fg-muted); }
.preview-card__stage { display: flex; justify-content: center; }

/* 폰 목업 */
/* 목업 이미지에 폰 프레임이 포함되어 있어 CSS bezel은 두지 않음 */
.phone { width: 250px; }
.phone__screen { display: block; }
.phone__mockup { display: block; width: 100%; height: auto; }
.phone__status { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px 2px; }
.phone__time { font-size: 11px; font-weight: 700; color: #111; }
.phone__status-ic { display: flex; gap: 4px; align-items: center; }
.phone__header { display: flex; align-items: center; justify-content: space-between; padding: 4px 12px 6px; }
.phone__logo { font-size: 13px; font-weight: 800; letter-spacing: -0.3px; color: #111; }
.phone__header-ic { display: flex; gap: 8px; align-items: center; }
.phone__search { margin: 0 12px 8px; height: 26px; border: 1px solid #e6e6e6; border-radius: 5px; background: #fff; }
.phone__tabs { display: flex; gap: 9px; padding: 0 12px 6px; }
.phone__tab { font-size: 10.5px; color: #b0b0b0; white-space: nowrap; }
.phone__tab--active { color: #111; font-weight: 700; border-bottom: 1.5px solid #111; padding-bottom: 2px; }
.phone__banner { position: relative; width: 100%; aspect-ratio: 1029 / 900; background: #ededed; overflow: hidden; }
.phone__banner img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.phone__banner-overlay {
  position: absolute; inset: 0; display: none; flex-direction: column; justify-content: flex-end;
  gap: 2px; padding: 12px; background: linear-gradient(to top, rgba(0,0,0,0.28), rgba(0,0,0,0) 55%);
}
.phone__banner.has-image .phone__banner-overlay { display: flex; }
.phone__banner-main { font-size: 12px; line-height: 15px; font-weight: 700; color: #fff; white-space: pre-line; }
.phone__banner-sub { font-size: 8.5px; line-height: 12px; color: rgba(255,255,255,0.92); }
.phone__banner-page { position: absolute; right: 10px; bottom: 12px; font-size: 8.5px; color: #fff; display: flex; align-items: center; gap: 3px; }
.phone__grid { display: flex; flex-direction: column; gap: 6px; padding: 8px 12px; }
.phone__grid-row { display: flex; gap: 6px; }
.phone__sk { background: #ededed; border-radius: 6px; height: 46px; flex: 1; }
.phone__live { padding: 4px 12px 6px; font-size: 12px; font-weight: 700; color: #111; }
.phone__live-row { display: flex; gap: 6px; padding: 0 12px 8px; }
.phone__live-row .phone__sk { height: 60px; }
.phone__nav { display: flex; align-items: center; justify-content: space-between; padding: 6px 14px 10px; border-top: 1px solid #f2f2f2; }
.phone__nav-item { display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 8px; color: #9a9a9a; }
.phone__nav-item--active { color: #111; font-weight: 700; }

/* ===================== Table (Column-based) ===================== */
/* Figma: 헤더(회색·14 semibold) + 선택 컬럼(checkbox/radio 44px) + 데이터 셀(14/20)
   + 행 상태(hover/selected/error/disabled) + pagination. 셀 border=행 구분선만(#d9d9d9). */
.mcds-table-wrap { border: 1px solid var(--border); border-radius: var(--r-8); overflow-x: auto; }
.mcds-table { width: 100%; border-collapse: collapse; font-family: var(--font); }
.mcds-table thead th {
  background: var(--fill-light-low); padding: 12px; text-align: left;
  font-size: 14px; line-height: 20px; font-weight: 600; color: var(--fg-default);
  border-bottom: 1px solid var(--border); white-space: nowrap;
}
.mcds-table th.mcds-table__sel, .mcds-table td.mcds-table__sel {
  width: 44px; padding: 0; text-align: center; vertical-align: middle;
}
.mcds-table tbody td {
  padding: 14px 12px; font-size: 14px; line-height: 20px; color: var(--fg-default);
  border-bottom: 1px solid var(--border); background: transparent;
}
.mcds-table tbody tr { background: var(--fill-light); transition: background-color 120ms ease; }
.mcds-table tbody tr:hover { background: var(--fill-light-low); }
.mcds-table tbody tr.is-selected { background: var(--accent-light-low); }
.mcds-table tbody tr.is-selected:hover { background: var(--accent-light-hovered); }
.mcds-table tbody tr.is-error { background: var(--critical-fill-hovered); }
.mcds-table tbody tr.is-disabled { cursor: not-allowed; }
.mcds-table tbody tr.is-disabled td { color: var(--fg-disabled); }
.mcds-table__num { text-align: right; font-variant-numeric: tabular-nums; }
.mcds-table__link { color: var(--accent); cursor: pointer; }
.mcds-table__th-inner { display: inline-flex; align-items: center; gap: 4px; }
.mcds-table__th-inner--right { justify-content: flex-end; width: 100%; }
.mcds-table__icon-btn { display: inline-flex; align-items: center; border: 0; background: transparent; padding: 0; cursor: pointer; color: #8c8c8c; }

/* Pagination */
.pagination { display: flex; align-items: center; justify-content: center; gap: 4px; margin-top: 16px; }
.pagination__item {
  min-width: 36px; height: 36px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center;
  border-radius: var(--r-4); border: 1px solid transparent; background: transparent;
  font-size: 14px; line-height: 20px; color: var(--fg-default); cursor: pointer;
}
.pagination__item:hover:not(.pagination__item--current):not([disabled]) { background: var(--fill-light-low); }
.pagination__item--current { border-color: var(--accent); color: var(--accent); font-weight: 600; cursor: default; }
.pagination__item--ellipsis { color: var(--fg-muted); cursor: default; }
.pagination__item[disabled] { color: var(--fg-disabled); cursor: not-allowed; }

/* ===================== Overlay / Modal / Alert ===================== */
/* Figma "Popup"(Modal) + Alert. dim 배경 위 흰 카드 radius 12, 헤더/푸터 구분선 #e6e6e6. */
.overlay {
  position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: rgba(0,0,0,0.45);
}
.overlay[hidden] { display: none; }

/* Modal (Popup) */
.modal {
  display: flex; flex-direction: column; width: 540px; max-width: 100%; max-height: 90vh;
  background: var(--fill-light); border-radius: 12px; box-shadow: 0 4px 16px 0 rgba(0,0,0,0.12);
}
.modal--540 { width: 540px; } .modal--660 { width: 660px; } .modal--780 { width: 780px; }
.modal--900 { width: 900px; } .modal--1020 { width: 1020px; }
.modal__header {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 24px; border-bottom: 1px solid var(--border-disabled);
}
.modal__title { font-size: 20px; line-height: 28px; font-weight: 600; color: var(--fg-default); }
.modal__close {
  display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px;
  border: 0; background: transparent; color: var(--fg-default); cursor: pointer; padding: 0;
}
.modal__body { padding: 24px; overflow-y: auto; flex: 1 1 auto; font-size: 14px; line-height: 20px; color: var(--fg-default); }
.modal__footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 24px; border-top: 1px solid var(--border-disabled);
}

/* Alert (compact confirm dialog — no dividers/close) */
.alert {
  display: flex; flex-direction: column; gap: 24px; width: 420px; max-width: 100%;
  padding: 24px; background: var(--fill-light); border-radius: 12px; box-shadow: 0 4px 16px 0 rgba(0,0,0,0.12);
}
.alert__text { display: flex; flex-direction: column; gap: 8px; }
.alert__title { font-size: 20px; line-height: 28px; font-weight: 600; color: var(--fg-default); }
.alert__desc { font-size: 14px; line-height: 20px; color: var(--fg-subtle); }
.alert__actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; }

/* ============================================================
   Prototype scaffolding — Drawer · Toast · Descriptions · Card ·
   Tabs · Select · inline Alert · Empty · 2-depth LNB
   Modal/Overlay/Alert(dialog)은 위의 공식 .overlay/.modal/.alert 재사용.
   나머지는 antd(Drawer/message/Select/Tabs/Descriptions/Card/Empty) 대체물로,
   Preflight Hi-Fi 목업 생성기가 사용하며 본편에서도 재사용 가능. 값은 :root 토큰 재사용.
   ============================================================ */

/* 공식 .overlay를 우측 정렬로 쓰는 Drawer용 modifier */
.overlay--right { align-items: stretch; justify-content: flex-end; padding: 0; }

/* Drawer (우측 슬라이드 패널) */
.mcds-drawer {
  width: 100%; max-width: 480px; height: 100vh;
  display: flex; flex-direction: column; background: var(--fill-light);
  box-shadow: -8px 0 28px rgba(0, 0, 0, 0.14);
}
.mcds-drawer__header {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 20px 24px; border-bottom: 1px solid var(--border-light);
}
.mcds-drawer__title { font-size: 18px; line-height: 26px; font-weight: 600; color: var(--fg-default); }
.mcds-drawer__close { border: 0; background: transparent; color: var(--fg-muted); font-size: 18px; cursor: pointer; padding: 4px; }
.mcds-drawer__close:hover { color: var(--fg-default); }
.mcds-drawer__body { padding: 24px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 16px; }
.mcds-drawer__footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px;
  padding: 16px 24px; border-top: 1px solid var(--border-light);
}

/* Toast / message (상단 중앙 스택) */
.mcds-toast-wrap {
  position: fixed; top: 24px; left: 50%; transform: translateX(-50%); z-index: 200;
  display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none;
}
.mcds-toast {
  display: inline-flex; align-items: center; gap: 8px; max-width: 90vw;
  padding: 10px 16px; border-radius: var(--r-8);
  background: var(--fill-light); border: 1px solid var(--border-light);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
  font-size: 14px; line-height: 20px; color: var(--fg-default);
}
.mcds-toast::before { content: ""; flex: 0 0 8px; width: 8px; height: 8px; border-radius: 50%; background: var(--fg-muted); }
.mcds-toast--success::before { background: #12b76a; }
.mcds-toast--error::before { background: var(--critical); }
.mcds-toast--info::before { background: var(--accent); }

/* Descriptions (key-value 상세) */
.mcds-desc { display: grid; grid-template-columns: 140px 1fr; row-gap: 12px; column-gap: 16px; width: 100%; }
.mcds-desc__label { font-size: 14px; line-height: 20px; font-weight: 500; color: var(--fg-subtle); }
.mcds-desc__value { font-size: 14px; line-height: 20px; color: var(--fg-default); }

/* Card / Statistic */
.mcds-card {
  display: flex; flex-direction: column; gap: 16px; width: 100%;
  padding: 20px 24px; background: var(--fill-light);
  border: 1px solid var(--border-light); border-radius: var(--r-8);
}
.mcds-card__title { font-size: 16px; line-height: 24px; font-weight: 600; color: var(--fg-default); }
.mcds-stat { display: flex; flex-direction: column; gap: 4px; }
.mcds-stat__label { font-size: 13px; line-height: 18px; color: var(--fg-muted); }
.mcds-stat__value { font-size: 24px; line-height: 32px; font-weight: 700; color: var(--fg-default); }

/* Tabs */
.mcds-tabs { display: flex; align-items: center; gap: 4px; width: 100%; border-bottom: 1px solid var(--border); }
.mcds-tab {
  padding: 10px 16px; margin-bottom: -1px; border: 0; border-bottom: 2px solid transparent;
  background: transparent; font-family: inherit; font-size: 14px; line-height: 20px;
  font-weight: 500; color: var(--fg-muted); cursor: pointer;
}
.mcds-tab:hover { color: var(--fg-default); }
.mcds-tab--active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }

/* Select (native, styled) */
.mcds-select {
  height: 36px; min-width: 160px; padding: 0 32px 0 8px;
  border: 1px solid var(--border); border-radius: var(--r-4);
  background-color: var(--fill-light);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23808080' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 8px center;
  font-family: inherit; font-size: 14px; line-height: 20px; color: var(--fg-default);
  appearance: none; -webkit-appearance: none; cursor: pointer;
}
.mcds-select:focus { outline: 0; border-color: var(--accent); }
.mcds-select:disabled { background-color: var(--fill-disabled); color: var(--fg-disabled); cursor: not-allowed; }

/* Alert */
.mcds-alert {
  display: flex; align-items: flex-start; gap: 8px; width: 100%;
  padding: 12px 16px; border-radius: var(--r-8);
  font-size: 14px; line-height: 20px;
}
.mcds-alert--info { background: var(--accent-bg-low); border: 1px solid var(--blue-90); color: var(--fg-default); }
.mcds-alert--error { background: var(--critical-fill-hovered); border: 1px solid var(--critical-border); color: var(--critical); }
.mcds-alert--success { background: #e7f7ef; border: 1px solid #a6e9c5; color: #027a48; }

/* Empty state */
.mcds-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px; padding: 48px 24px; color: var(--fg-muted);
}
.mcds-empty__title { font-size: 14px; line-height: 20px; color: var(--fg-muted); }

/* LNB 2-depth 하위 항목 */
.nav-item--sub { padding-left: 36px; }
.nav-item--sub .nav-item__label { font-size: 13px; font-weight: 400; color: var(--fg-muted); }
.nav-item--sub.nav-item--active .nav-item__label { color: var(--accent); font-weight: 500; }
`
