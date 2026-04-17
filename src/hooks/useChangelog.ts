import { useEffect, useState } from "react";

const CURRENT_VERSION = "1.2.0"; // 업데이트마다 이 값만 바꾸면 됩니다
const STORAGE_KEY = "preflight_seen_version";

export function useChangelog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const seenVersion = localStorage.getItem(STORAGE_KEY);
    if (seenVersion !== CURRENT_VERSION) {
      setIsOpen(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setIsOpen(false);
  };

  return { isOpen, dismiss, version: CURRENT_VERSION };
}
