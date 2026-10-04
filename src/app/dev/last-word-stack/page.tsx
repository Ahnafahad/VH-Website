import { notFound } from 'next/navigation';
import SmokeLoader from './SmokeLoader';

export default function LastWordStackPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <SmokeLoader />;
}
