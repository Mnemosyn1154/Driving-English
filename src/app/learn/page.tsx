'use client';

import React from 'react';
import { LearnInterface } from './LearnInterface';
import { withAuth } from '@/components/Auth/withAuth';

function LearnPage() {
  return <LearnInterface />;
}

export default withAuth(LearnPage, { allowSkipAuth: true });