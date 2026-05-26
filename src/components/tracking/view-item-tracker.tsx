'use client';

import { useEffect, useRef } from 'react';
import { trackViewItem } from '@/lib/tracking';

interface ViewItemTrackerProps {
  item: {
    item_id: string;
    item_name: string;
    price: number;
    item_category?: string;
    item_brand?: string;
  };
}

export function ViewItemTracker({ item }: ViewItemTrackerProps) {
  const tracked = useRef(false);

  useEffect(() => {
    if (!tracked.current) {
      trackViewItem(item);
      tracked.current = true;
    }
  }, [item]);

  return null;
}
