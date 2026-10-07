import { Loader2 } from 'lucide-react';
import { MUTED } from '@/components/admin/lms/tokens';

// The student progress read is heavy, so say what is loading.
export default function Loading() {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: '50vh', color: MUTED, fontSize: 14 }}>
      <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} aria-hidden />
      Loading student progress…
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
