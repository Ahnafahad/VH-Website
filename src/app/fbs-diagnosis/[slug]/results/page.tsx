'use client';

import { use } from 'react';
import DiagnosticResultsClient from './DiagnosticResultsClient';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function DiagnosticResultsPage({ params }: PageProps) {
  const { slug } = use(params);
  return <DiagnosticResultsClient slug={slug} />;
}
