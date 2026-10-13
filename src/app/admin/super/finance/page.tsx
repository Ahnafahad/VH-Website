import FinanceClient from '@/components/admin/super/finance/FinanceClient';

export const metadata = { title: 'Finance — VH Super Admin' };
export const dynamic = 'force-dynamic';

export default function FinancePage() {
  return <FinanceClient />;
}
