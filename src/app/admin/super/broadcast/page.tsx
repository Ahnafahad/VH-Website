import BroadcastClient from '@/components/admin/super/comms/BroadcastClient';

export const metadata = { title: 'Broadcast — VH Super Admin' };
export const dynamic = 'force-dynamic';

export default function BroadcastPage() {
  return <BroadcastClient />;
}
