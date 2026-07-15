import { Metadata } from 'next';
import ErrorLogsClient from './ErrorLogsClient';

export const metadata: Metadata = {
  title: 'Error Logs — VH Admin',
};

export default function AdminErrorLogsPage() {
  return <ErrorLogsClient />;
}
