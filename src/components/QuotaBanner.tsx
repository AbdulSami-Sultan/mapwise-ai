/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export const QuotaBanner: React.FC = () => {
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      setQuotaExceeded(true);
      setDismissed(false);
    };

    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  if (!quotaExceeded || dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm flex items-center justify-between">
      <div className="flex-1 flex items-center justify-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
        <span>
          Google Maps Platform quota reached. If you are the app owner, visit{' '}
          <a
            href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-semibold text-amber-950 hover:text-amber-800"
          >
            maps developer site
          </a>{' '}
          for instructions to update your account.
        </span>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="p-1 hover:bg-amber-100 rounded text-amber-700 ml-2"
        aria-label="Dismiss quota warning"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
