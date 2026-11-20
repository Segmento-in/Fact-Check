import React from 'react';
import { ReportView } from '@/components/ReportView';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;
  return <ReportView id={id} />;
}

