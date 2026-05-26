// src/lib/tracking.ts

// Declare dataLayer type for window
declare global {
  interface Window {
    dataLayer?: any[];
  }
}

/**
 * Push an event to the GTM dataLayer
 */
export const pushToDataLayer = (eventName: string, payload: any) => {
  if (typeof window !== "undefined" && window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...payload,
    });
  }
};

/**
 * Standard E-commerce Events for GA4 / FB Pixel
 */

export const trackViewItem = (item: {
  item_id: string;
  item_name: string;
  price: number;
  item_category?: string;
  item_brand?: string;
}) => {
  pushToDataLayer("view_item", {
    ecommerce: {
      currency: "VND",
      value: item.price,
      items: [
        {
          item_id: item.item_id,
          item_name: item.item_name,
          price: item.price,
          item_category: item.item_category,
          item_brand: item.item_brand,
          quantity: 1,
        },
      ],
    },
  });
};

export const trackAddToCart = (item: {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  item_category?: string;
  item_brand?: string;
}) => {
  pushToDataLayer("add_to_cart", {
    ecommerce: {
      currency: "VND",
      value: item.price * item.quantity,
      items: [
        {
          item_id: item.item_id,
          item_name: item.item_name,
          price: item.price,
          item_category: item.item_category,
          item_brand: item.item_brand,
          quantity: item.quantity,
        },
      ],
    },
  });
};

export const trackPurchase = (transaction_id: string, value: number, items: any[]) => {
  pushToDataLayer("purchase", {
    ecommerce: {
      transaction_id,
      value,
      currency: "VND",
      items,
    },
  });
};

export const trackGenerateLead = (source: string) => {
  pushToDataLayer("generate_lead", {
    lead_source: source,
  });
};
