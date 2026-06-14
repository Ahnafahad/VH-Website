import { Metadata } from 'next';
import AnalyticsDashboard from '@/components/admin/analytics/AnalyticsDashboard';

export const metadata: Metadata = {
  title: 'Analytics — VH Admin',
};

export default function AdminAnalyticsPage() {
  return <AnalyticsDashboard />;
}
