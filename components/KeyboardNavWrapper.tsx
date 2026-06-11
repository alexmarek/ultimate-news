'use client';

import { useKeyboardNav } from '@/components/useKeyboardNav';
import HelpModal from '@/components/HelpModal';

export default function KeyboardNavWrapper({
  articleIds,
  children,
}: {
  articleIds: string[];
  children: React.ReactNode;
}) {
  const { showHelp, setShowHelp } = useKeyboardNav(articleIds);

  return (
    <>
      {children}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
}
